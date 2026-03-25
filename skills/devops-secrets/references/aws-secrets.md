# AWS Secrets Manager Guide

## Overview

AWS Secrets Manager stores, retrieves, and auto-rotates credentials, API keys, and other secrets. It integrates natively with RDS, Redshift, DocumentDB, and other AWS services for automatic password rotation.

---

## Create Secrets via CLI

### Plain Text Secret

```bash
# Create a simple key/value secret
aws secretsmanager create-secret \
  --name myapp/production/database \
  --description "Production database credentials" \
  --secret-string '{"username":"app_user","password":"s3cret-p4ss","host":"db.internal","port":"5432","dbname":"myapp"}'

# Create from a file
aws secretsmanager create-secret \
  --name myapp/production/api-keys \
  --secret-string file://secrets.json

# Create a binary secret (certificates, keystores)
aws secretsmanager create-secret \
  --name myapp/production/tls-cert \
  --secret-binary fileb://cert.p12
```

### Manage Secrets

```bash
# List all secrets
aws secretsmanager list-secrets --query 'SecretList[].Name' --output table

# Get current secret value
aws secretsmanager get-secret-value \
  --secret-id myapp/production/database \
  --query SecretString --output text

# Update a secret
aws secretsmanager update-secret \
  --secret-id myapp/production/database \
  --secret-string '{"username":"app_user","password":"new-p4ss","host":"db.internal","port":"5432","dbname":"myapp"}'

# Tag a secret
aws secretsmanager tag-resource \
  --secret-id myapp/production/database \
  --tags Key=Environment,Value=production Key=Team,Value=backend

# Delete a secret (with recovery window)
aws secretsmanager delete-secret \
  --secret-id myapp/staging/old-secret \
  --recovery-window-in-days 7

# Force delete immediately (no recovery)
aws secretsmanager delete-secret \
  --secret-id myapp/staging/old-secret \
  --force-delete-without-recovery
```

---

## Retrieve in Application Code

### Node.js

```javascript
// Using AWS SDK v3
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretId) {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);

  if (response.SecretString) {
    return JSON.parse(response.SecretString);
  }
  // Binary secret
  return Buffer.from(response.SecretBinary);
}

// Usage with caching (recommended for Lambda/hot paths)
let cachedDbCreds = null;
let cacheExpiry = 0;

async function getDbCredentials() {
  const now = Date.now();
  if (cachedDbCreds && now < cacheExpiry) {
    return cachedDbCreds;
  }

  cachedDbCreds = await getSecret("myapp/production/database");
  cacheExpiry = now + 300_000; // Cache for 5 minutes
  return cachedDbCreds;
}

// Connect to database
const creds = await getDbCredentials();
const connectionString = `postgres://${creds.username}:${creds.password}@${creds.host}:${creds.port}/${creds.dbname}`;
```

### Python

```python
import json
import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

secrets_client = boto3.client("secretsmanager", region_name="us-east-1")


def get_secret(secret_id: str) -> dict:
    """Retrieve and parse a secret from AWS Secrets Manager."""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_id)
        if "SecretString" in response:
            return json.loads(response["SecretString"])
        # Binary secret
        return response["SecretBinary"]
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "ResourceNotFoundException":
            raise ValueError(f"Secret {secret_id} not found") from e
        if error_code == "AccessDeniedException":
            raise PermissionError(f"No access to secret {secret_id}") from e
        raise


# With caching (for long-running processes)
@lru_cache(maxsize=32)
def get_secret_cached(secret_id: str) -> dict:
    return get_secret(secret_id)


# Usage
creds = get_secret("myapp/production/database")
connection_string = (
    f"postgresql://{creds['username']}:{creds['password']}"
    f"@{creds['host']}:{creds['port']}/{creds['dbname']}"
)
```

### Go

```go
package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type DatabaseCreds struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `json:"host"`
	Port     string `json:"port"`
	DBName   string `json:"dbname"`
}

type SecretCache struct {
	client  *secretsmanager.Client
	cache   map[string]cacheEntry
	mu      sync.RWMutex
	ttl     time.Duration
}

type cacheEntry struct {
	value     string
	expiresAt time.Time
}

func NewSecretCache(ctx context.Context, region string, ttl time.Duration) (*SecretCache, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	return &SecretCache{
		client: secretsmanager.NewFromConfig(cfg),
		cache:  make(map[string]cacheEntry),
		ttl:    ttl,
	}, nil
}

func (sc *SecretCache) GetSecret(ctx context.Context, secretID string) (string, error) {
	sc.mu.RLock()
	if entry, ok := sc.cache[secretID]; ok && time.Now().Before(entry.expiresAt) {
		sc.mu.RUnlock()
		return entry.value, nil
	}
	sc.mu.RUnlock()

	result, err := sc.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: &secretID,
	})
	if err != nil {
		return "", fmt.Errorf("fetching secret %s: %w", secretID, err)
	}

	sc.mu.Lock()
	sc.cache[secretID] = cacheEntry{
		value:     *result.SecretString,
		expiresAt: time.Now().Add(sc.ttl),
	}
	sc.mu.Unlock()

	return *result.SecretString, nil
}

func (sc *SecretCache) GetDatabaseCreds(ctx context.Context, secretID string) (*DatabaseCreds, error) {
	raw, err := sc.GetSecret(ctx, secretID)
	if err != nil {
		return nil, err
	}

	var creds DatabaseCreds
	if err := json.Unmarshal([]byte(raw), &creds); err != nil {
		return nil, fmt.Errorf("parsing secret %s: %w", secretID, err)
	}
	return &creds, nil
}
```

---

## Auto-Rotation with Lambda (RDS Password Rotation)

### Enable Rotation for an RDS Secret

```bash
# Create the secret with RDS credentials
aws secretsmanager create-secret \
  --name myapp/production/rds-postgres \
  --secret-string '{"username":"admin","password":"initial-pass","engine":"postgres","host":"mydb.cluster-abc123.us-east-1.rds.amazonaws.com","port":"5432","dbname":"myapp"}'

# Enable automatic rotation using the AWS-provided Lambda
aws secretsmanager rotate-secret \
  --secret-id myapp/production/rds-postgres \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRDSPostgreSQLRotation \
  --rotation-rules '{"AutomaticallyAfterDays": 30}'
```

### CloudFormation for Rotation Setup

```yaml
# cloudformation/rds-secret-rotation.yaml
AWSTemplateFormatVersion: "2010-09-09"

Resources:
  DatabaseSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: myapp/production/rds-postgres
      GenerateSecretString:
        SecretStringTemplate: '{"username": "app_admin"}'
        GenerateStringKey: password
        PasswordLength: 32
        ExcludeCharacters: '"@/\'

  DatabaseInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: postgres
      EngineVersion: "16.4"
      MasterUsername: !Sub "{{resolve:secretsmanager:${DatabaseSecret}:SecretString:username}}"
      MasterUserPassword: !Sub "{{resolve:secretsmanager:${DatabaseSecret}:SecretString:password}}"
      DBInstanceClass: db.r6g.large
      AllocatedStorage: 100

  SecretRotationSchedule:
    Type: AWS::SecretsManager::RotationSchedule
    DependsOn: SecretTargetAttachment
    Properties:
      SecretId: !Ref DatabaseSecret
      HostedRotationLambda:
        RotationType: PostgreSQLSingleUser
        VpcSecurityGroupIds: !Ref DBSecurityGroup
        VpcSubnetIds: !Join [",", [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
      RotationRules:
        AutomaticallyAfterDays: 30

  SecretTargetAttachment:
    Type: AWS::SecretsManager::SecretTargetAttachment
    Properties:
      SecretId: !Ref DatabaseSecret
      TargetId: !Ref DatabaseInstance
      TargetType: AWS::RDS::DBInstance
```

---

## ECS Task Definition: valueFrom

```json
{
  "family": "myapp",
  "taskRoleArn": "arn:aws:iam::123456789012:role/myapp-task-role",
  "executionRoleArn": "arn:aws:iam::123456789012:role/myapp-execution-role",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest",
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/database-url-AbCdEf"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/database-AbCdEf:password::"
        },
        {
          "name": "API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/api-keys-AbCdEf:stripe_key::"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

The `valueFrom` ARN format for JSON secrets: `arn:...:secret-name-random:json_key:version_stage:version_id`

The **execution role** (not task role) needs `secretsmanager:GetSecretValue` permission to inject secrets at container startup.

---

## Lambda Environment: Reference Secrets

### Direct SDK Fetch (Recommended)

```python
# lambda_function.py
import json
import os
import boto3

secrets_client = boto3.client("secretsmanager")

# Fetch once during cold start (outside handler)
_db_secret = None

def _get_db_secret():
    global _db_secret
    if _db_secret is None:
        response = secrets_client.get_secret_value(
            SecretId=os.environ["DB_SECRET_ARN"]
        )
        _db_secret = json.loads(response["SecretString"])
    return _db_secret

def handler(event, context):
    creds = _get_db_secret()
    # Use creds["password"], creds["host"], etc.
    return {"statusCode": 200}
```

### Lambda with AWS Parameters and Secrets Extension

```yaml
# SAM template
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: python3.12
      Handler: lambda_function.handler
      Layers:
        # AWS Parameters and Secrets Lambda Extension
        - arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:12
      Environment:
        Variables:
          DB_SECRET_ARN: !Ref DatabaseSecret
          SECRETS_MANAGER_TTL: 300
      Policies:
        - AWSSecretsManagerGetSecretValuePolicy:
            SecretArn: !Ref DatabaseSecret
```

The extension provides a local HTTP cache at `localhost:2773`, reducing API calls and latency:

```python
import json
import os
import urllib.request

def get_secret_via_extension(secret_arn):
    """Use the Parameters and Secrets Extension local cache."""
    url = f"http://localhost:2773/secretsmanager/get?secretId={secret_arn}"
    headers = {"X-Aws-Parameters-Secrets-Token": os.environ["AWS_SESSION_TOKEN"]}
    req = urllib.request.Request(url, headers=headers)
    response = urllib.request.urlopen(req)
    return json.loads(json.loads(response.read())["SecretString"])
```

---

## IAM Policies for Accessing Secrets (Least Privilege)

### Application Read-Only Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOwnSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/Environment": "production",
          "aws:ResourceTag/Application": "myapp"
        }
      }
    }
  ]
}
```

### ECS Execution Role (for secret injection)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECSSecretAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/*"
      ]
    },
    {
      "Sid": "DecryptWithKMS",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:123456789012:key/your-kms-key-id"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

### Admin Policy (for managing secrets)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecrets",
        "secretsmanager:TagResource",
        "secretsmanager:RotateSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/*"
      ]
    }
  ]
}
```

---

## Cost

| Component | Price |
|---|---|
| Secret storage | $0.40 per secret per month |
| API calls | $0.05 per 10,000 API calls |
| Rotation Lambda | Standard Lambda pricing (usually negligible) |

**Cost optimization tips:**

- Store multiple related values in a single JSON secret (one secret, one charge)
- Use client-side caching to reduce API calls
- Use SSM Parameter Store for non-sensitive configuration (free for standard params)
- Delete unused secrets promptly (billing continues during recovery window)

**Example:** 50 secrets with 1M API calls/month = $50 * $0.40 + 100 * $0.05 = $25/month

---

## Cross-Account Secret Sharing

### In the Source Account (owns the secret)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::999888777666:role/consumer-app-role"
      },
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "*"
    }
  ]
}
```

Apply with:

```bash
aws secretsmanager put-resource-policy \
  --secret-id myapp/shared/api-key \
  --resource-policy file://cross-account-policy.json
```

### In the Consumer Account

The consumer account role also needs an IAM policy allowing access to the source account's secret ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/shared/api-key-*"
    },
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/source-account-kms-key-id"
    }
  ]
}
```

Note: If the secret is encrypted with a custom KMS key, you must also grant `kms:Decrypt` cross-account on that key.

---

## Secrets Manager vs SSM Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---|---|---|
| **Price** | $0.40/secret/month + API calls | Free (standard), $0.05/advanced/month |
| **Max size** | 64 KB | 4 KB (standard), 8 KB (advanced) |
| **Auto-rotation** | Built-in with Lambda | Manual only |
| **Cross-account** | Resource policies | Not natively supported |
| **Versioning** | Automatic (staging labels) | Built-in version history |
| **Encryption** | Always encrypted (KMS) | Optional encryption (KMS) |
| **Hierarchical** | Path-based naming (convention) | Native path hierarchy with GetParametersByPath |
| **CloudFormation resolve** | `{{resolve:secretsmanager:...}}` | `{{resolve:ssm:...}}` |
| **ECS native injection** | `valueFrom` with ARN | `valueFrom` with ARN |
| **Audit** | CloudTrail | CloudTrail |
| **Throughput** | 10,000 TPS default | 40 TPS standard, 1,000 TPS with higher tier |

### When to Use Which

**Use Secrets Manager when:**
- You need automatic credential rotation
- Storing database passwords, API keys, OAuth tokens
- Cross-account secret sharing is required
- You want managed rotation Lambda functions

**Use SSM Parameter Store when:**
- Storing non-sensitive configuration (feature flags, endpoint URLs)
- Cost sensitivity is high (free tier)
- You need hierarchical parameter organization
- Simple string or string list values suffice

**Common pattern:** Use both together. SSM for config, Secrets Manager for actual secrets.

---

## Best Practices

1. **Use JSON for structured secrets** -- store related credentials in a single secret to reduce cost
2. **Namespace with paths** -- `{app}/{environment}/{secret-name}` for organization
3. **Tag everything** -- Environment, Team, Application tags for cost allocation and access control
4. **Enable rotation** -- especially for database credentials; 30-day rotation is a common baseline
5. **Cache in application** -- use 5-minute TTL caching to reduce API calls and latency
6. **Use resource policies** -- for cross-account; avoid IAM user credentials
7. **Encrypt with CMK** -- use customer-managed KMS keys for secrets shared cross-account
8. **Monitor with CloudTrail** -- alert on unusual `GetSecretValue` calls or failed access attempts
9. **Avoid hardcoding ARNs** -- use CloudFormation/Terraform references or SSM parameters to store ARNs
10. **Test rotation** -- manually trigger rotation in staging before enabling automatic rotation in production

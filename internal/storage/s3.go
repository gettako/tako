package storage

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config holds connection parameters for any S3-compatible object store.
type S3Config struct {
	EndpointURL  string `json:"endpoint_url"`
	Bucket       string `json:"bucket"`
	Region       string `json:"region"`
	AccessKey    string `json:"access_key"`
	SecretKey    string `json:"secret_key"`
	UsePathStyle bool   `json:"use_path_style"`
}

// S3Client wraps the AWS S3 client with high-level operations.
type S3Client struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
}

// NewS3Client initializes an S3Client with custom endpoint and path-style addressing if needed.
func NewS3Client(ctx context.Context, cfg S3Config) (*S3Client, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("s3 bucket is required")
	}
	region := cfg.Region
	if region == "" {
		region = "us-east-1"
	}

	creds := credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")

	opts := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(creds),
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Opts := func(o *s3.Options) {
		if cfg.EndpointURL != "" {
			endpoint := strings.TrimRight(cfg.EndpointURL, "/")
			o.BaseEndpoint = aws.String(endpoint)
		}
		o.UsePathStyle = cfg.UsePathStyle
	}

	client := s3.NewFromConfig(awsCfg, s3Opts)
	presignClient := s3.NewPresignClient(client)

	return &S3Client{
		client:        client,
		presignClient: presignClient,
		bucket:        cfg.Bucket,
	}, nil
}

// Upload uploads a stream of data to S3.
func (c *S3Client) Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	input := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		Body:   body,
	}
	if size > 0 {
		input.ContentLength = aws.Int64(size)
	}
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}

	_, err := c.client.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to upload object to s3 (%s): %w", key, err)
	}
	return nil
}

// Download retrieves an object from S3 as a ReadCloser.
func (c *S3Client) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	output, err := c.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download object from s3 (%s): %w", key, err)
	}
	return output.Body, nil
}

// Delete removes an object from S3.
func (c *S3Client) Delete(ctx context.Context, key string) error {
	_, err := c.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object from s3 (%s): %w", key, err)
	}
	return nil
}

// GetPresignedURL generates a temporary presigned GET URL for downloading an object.
func (c *S3Client) GetPresignedURL(ctx context.Context, key string, lifetime time.Duration) (string, error) {
	if lifetime <= 0 {
		lifetime = 15 * time.Minute
	}
	req, err := c.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(lifetime))
	if err != nil {
		return "", fmt.Errorf("failed to presign get object (%s): %w", key, err)
	}
	return req.URL, nil
}

// TestConnection verifies access to the target bucket.
func (c *S3Client) TestConnection(ctx context.Context) error {
	_, err := c.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(c.bucket),
	})
	if err != nil {
		// Fallback to ListObjectsV2 with max 1 key in case HeadBucket permissions are restricted
		_, listErr := c.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:  aws.String(c.bucket),
			MaxKeys: aws.Int32(1),
		})
		if listErr != nil {
			return fmt.Errorf("s3 bucket connection test failed: %w", err)
		}
	}
	return nil
}

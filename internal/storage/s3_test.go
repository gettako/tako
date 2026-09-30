package storage

import (
	"context"
	"testing"
)

func TestNewS3Client_Validation(t *testing.T) {
	ctx := context.Background()

	// Missing bucket
	_, err := NewS3Client(ctx, S3Config{
		Bucket: "",
	})
	if err == nil {
		t.Fatal("expected error for empty bucket, got nil")
	}

	// Valid config with custom endpoint
	client, err := NewS3Client(ctx, S3Config{
		EndpointURL: "https://s3.us-west-002.backblazeb2.com",
		Bucket:      "my-test-bucket",
		Region:      "us-west-002",
		AccessKey:   "test-access-key",
		SecretKey:   "test-secret-key",
	})
	if err != nil {
		t.Fatalf("unexpected error creating S3 client: %v", err)
	}
	if client == nil {
		t.Fatal("expected client to be non-nil")
	}
	if client.bucket != "my-test-bucket" {
		t.Fatalf("expected bucket 'my-test-bucket', got '%s'", client.bucket)
	}
}

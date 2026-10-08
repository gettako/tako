import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function hmac(key: string | Buffer, string: string): Buffer {
  return crypto.createHmac('sha256', key).update(string).digest();
}

function sha256(string: string): string {
  return crypto.createHash('sha256').update(string).digest('hex');
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = hmac('AWS4' + key, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEndpoint = (body.endpoint || '').trim();
    const bucket = (body.bucket || '').trim();
    const region = (body.region || 'us-east-1').trim() || 'us-east-1';
    const accessKeyId = (body.accessKeyId || '').trim();
    const secretAccessKey = (body.secretAccessKey || '').trim();

    if (!rawEndpoint) {
      return NextResponse.json(
        { ok: false, latencyMs: 0, message: 'S3 endpoint URL is required' },
        { status: 400 }
      );
    }

    if (!bucket) {
      return NextResponse.json(
        { ok: false, latencyMs: 0, message: 'Bucket name is required' },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawEndpoint);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Protocol must be http or https');
      }
    } catch {
      return NextResponse.json(
        { ok: false, latencyMs: 0, message: 'Invalid endpoint format. Must start with http:// or https://' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // If both accessKeyId and secretAccessKey are provided, perform real AWS SigV4 signed request
    if (accessKeyId && secretAccessKey) {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);

      const targetPath = `/${encodeURIComponent(bucket)}`;
      const targetQuery = 'max-keys=0';
      const targetUrl = `${parsedUrl.origin}${targetPath}?${targetQuery}`;

      const canonicalHeaders = `host:${parsedUrl.host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`;
      const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

      const canonicalRequest = `GET\n${targetPath}\n${targetQuery}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
      const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;

      const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 's3');
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      try {
        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            Host: parsedUrl.host,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
            Authorization: authHeader,
          },
          signal: AbortSignal.timeout(7000),
        });

        const latencyMs = Math.max(1, Date.now() - startTime);

        if (res.ok || res.status === 200) {
          return NextResponse.json({
            ok: true,
            latencyMs,
            message: `Connected successfully to bucket "${bucket}" (HTTP 200 OK)`,
          });
        }

        const resText = await res.text().catch(() => '');

        if (res.status === 403) {
          if (resText.includes('InvalidAccessKeyId')) {
            return NextResponse.json({
              ok: false,
              latencyMs,
              message: 'Invalid Access Key ID (HTTP 403 Forbidden)',
            });
          }
          if (resText.includes('SignatureDoesNotMatch')) {
            return NextResponse.json({
              ok: false,
              latencyMs,
              message: 'Invalid Secret Access Key or signature mismatch (HTTP 403 Forbidden)',
            });
          }
          if (resText.includes('AccessDenied')) {
            return NextResponse.json({
              ok: false,
              latencyMs,
              message: `Access Denied: Key lacks permission for bucket "${bucket}" (HTTP 403)`,
            });
          }
          return NextResponse.json({
            ok: false,
            latencyMs,
            message: 'Authentication failed (HTTP 403 Forbidden). Verify credentials and region.',
          });
        }

        if (res.status === 404) {
          return NextResponse.json({
            ok: false,
            latencyMs,
            message: `Bucket "${bucket}" was not found at endpoint (HTTP 404)`,
          });
        }

        if (res.status === 301) {
          const expectedRegion = res.headers.get('x-amz-bucket-region') || 'another region';
          return NextResponse.json({
            ok: false,
            latencyMs,
            message: `Bucket is located in ${expectedRegion}. Update region setting (HTTP 301).`,
          });
        }

        return NextResponse.json({
          ok: false,
          latencyMs,
          message: `S3 endpoint responded with HTTP ${res.status}: ${res.statusText || 'Error'}`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Connection failed';
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: `Connection error: ${errorMsg}. Verify endpoint reachability.`,
        });
      }
    }

    // Direct endpoint connectivity probe when credentials not provided
    try {
      const probeRes = await fetch(parsedUrl.origin, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Math.max(1, Date.now() - startTime);
      return NextResponse.json({
        ok: true,
        latencyMs,
        message: `Endpoint ${parsedUrl.host} is reachable (HTTP ${probeRes.status}, ${latencyMs}ms)`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Host unreachable';
      return NextResponse.json({
        ok: false,
        latencyMs: Date.now() - startTime,
        message: `Unable to reach endpoint host ${parsedUrl.host}: ${errorMsg}`,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ ok: false, latencyMs: 0, message: errorMsg }, { status: 500 });
  }
}

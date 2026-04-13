import json
import base64
import os
import hmac
import functions_framework
from image_protect import protect_image


def _auth_ok(auth_header: str) -> bool:
    expected = os.environ.get("CLOUD_FUNCTION_API_KEY", "").strip()
    if not expected:
        return True
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    token = auth_header[len("Bearer "):].strip()
    return hmac.compare_digest(token, expected)


@functions_framework.http
def protect_image_endpoint(request):
    # 1. Handle CORS preflight FIRST (before checking POST)
    if request.method == "OPTIONS":
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600',
        }
        return ('', 204, headers)

    # 2. Reject non-POST requests
    if request.method != 'POST':
        return (json.dumps({'error': 'Only POST method is supported'}), 405, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })

    # 3. Authenticate
    auth = request.headers.get("Authorization", "")
    if not _auth_ok(auth):
        return (json.dumps({"error": "Unauthorized"}), 401, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        })

    # 4. Parse Payload (Aligned with React Native Frontend)
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image_base64", "")
    
    if not image_b64:
        return (json.dumps({'error': 'No image_base64 provided'}), 400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })

    try:
        # Strip data URI prefix if the frontend sends one
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
            
        image_bytes = base64.b64decode(image_b64)
        strength = float(data.get('strength', 0.05))
        uuid = data.get('uuid')

    except Exception:
        return (json.dumps({'error': 'Invalid base64 image data'}), 400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })

    # 5. Run Protection Pipeline
    result = protect_image(image_bytes, strength, uuid)

    if not result['success']:
        return (json.dumps({'error': result.get('error', 'Protection failed')}), 500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })

    # 6. Return Response (Aligned with React Native Frontend)
    # Return RAW base64, not a data URI, because normalizeBase64Payload expects raw base64
    output_b64 = base64.b64encode(result['image_bytes']).decode('utf-8')

    response_data = {
        'perturbed_image_base64': output_b64,  # Frontend looks for this key
        'protectionId': result['protection_id'],
        'protectionsApplied': result['protections_applied'],
        'strength': result['strength'],
    }

    return (json.dumps(response_data), 200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    })
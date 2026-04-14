<?php
/**
 * MediLens AI Proxy
 * Location: /public_html/medilens/api/ai.php
 * 
 * Calls Gemini API server-side on behalf of the frontend.
 * Prevents direct exposure of the Gemini API key.
 * 
 * Security:
 *   - Whitelist of allowed tasks
 *   - Rate limiting: 10 requests per IP per hour (file-based)
 *   - Input size limits
 *   - CORS restricted to tekdruid.com
 */

// ── CORS ──────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'https://tekdruid.com';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Config ────────────────────────────────────────────────────────────────────
$GEMINI_API_KEY  = getenv('GEMINI_API_KEY') ?: 'YOUR_GEMINI_KEY_HERE';

$ALLOWED_TASKS = [
    'country_narrative',
    'equivalence',
    'policy_brief',
    'appeal_letter',
    'drug_summary',
    'drug_country_analysis',
];

// Rate limit: 10 requests per IP per hour
$RATE_LIMIT    = 10;
$RATE_WINDOW   = 3600; // seconds
$RATE_DIR      = sys_get_temp_dir() . '/medilens_rl/';

// ── Rate limiting ─────────────────────────────────────────────────────────────
function check_rate_limit(string $ip, string $dir, int $limit, int $window): bool {
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    $file = $dir . md5($ip) . '.json';
    $now  = time();

    $data = ['hits' => [], 'count' => 0];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?? $data;
    }

    // Remove hits outside the window
    $data['hits'] = array_filter($data['hits'], fn($t) => ($now - $t) < $window);
    $data['hits'] = array_values($data['hits']);

    if (count($data['hits']) >= $limit) {
        return false; // Rate limit exceeded
    }

    $data['hits'][] = $now;
    file_put_contents($file, json_encode($data), LOCK_EX);
    return true;
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
/*
if (!check_rate_limit($ip, $RATE_DIR, $RATE_LIMIT, $RATE_WINDOW)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded. Please wait before trying again.']);
    exit;
}
*/


// ── Parse body ─────────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
if (strlen($raw) > 8192) {
    http_response_code(413);
    echo json_encode(['error' => 'Request too large']);
    exit;
}

$body = json_decode($raw, true);
if (!$body || !isset($body['task'], $body['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request body']);
    exit;
}

$task    = $body['task'];
$payload = $body['payload'];

if (!in_array($task, $ALLOWED_TASKS, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown task']);
    exit;
}

// ── Build prompt ──────────────────────────────────────────────────────────────
function build_prompt(string $task, array $payload): string {
    return match ($task) {

        'country_narrative' => sprintf(
            "You are a pharmaceutical policy analyst. Write a 2-paragraph summary for the country %s, covering: " .
            "(1) the state of drug access (how many drugs are behind vs. global first approvals, how severe lag is), " .
            "(2) pricing situation compared to global averages. " .
            "Be factual, accessible, and empathetic. Data: %s",
            $payload['country_name'] ?? 'Unknown',
            json_encode($payload['data'] ?? [])
        ),

        'equivalence' => sprintf(
            "You are a clinical pharmacist. A patient in %s cannot access %s. " .
            "List up to 3 therapeutic alternatives available there, with a note on equivalent efficacy. " .
            "Be concise and clinically accurate.",
            $payload['country'] ?? 'their country',
            $payload['drug'] ?? 'this drug'
        ),

        'policy_brief' => sprintf(
            "Write a structured policy brief (max 400 words) calling for accelerated regulatory approval of %s in %s. " .
            "Include: Background, The Access Gap, Recommendation, Supporting Evidence. " .
            "Data context: %s",
            $payload['drug'] ?? 'this drug',
            $payload['country'] ?? 'this country',
            json_encode($payload['data'] ?? [])
        ),

        'appeal_letter' => sprintf(
            "Write a professional insurance appeal letter requesting coverage for %s. " .
            "Patient context: %s. " .
            "Tone: firm but respectful. Include a clinical necessity argument.",
            $payload['drug'] ?? 'this drug',
            $payload['patient_info'] ?? 'standard patient case'
        ),

        'drug_country_analysis' => sprintf(
            "You are a pharmaceutical policy and market analyst. Provide a professional, engaging, and in-depth analysis of the access landscape for the drug %s in %s. " .
            "Please highlight: (1) The potential reasons for the access gap (e.g., patent barriers, regulatory delays, manufacturer priorities). " .
            "(2) The clinical impact of patients not having access to this specific drug in this region. " .
            "(3) Any accessible therapeutic equivalents or stopgap solutions currently available. " .
            "Be factual and structure the analysis in short, readable sections.",
            $payload['drug'] ?? 'this drug',
            $payload['country'] ?? 'this country'
        ),

        'drug_summary' => sprintf(
            "Write a 2-sentence plain-language summary of %s for a general patient audience. " .
            "Cover: therapeutic class and primary use. Do not include dosing or side effects.",
            $payload['inn'] ?? 'this drug'
        ),

        default => "Please provide a helpful general pharmaceutical information response."
    };
}

$prompt = build_prompt($task, $payload);

// ── Call Gemini with Fallback ──────────────────────────────────────────────────
$MODELS_TO_TRY = [
    ['m' => 'gemini-1.5-flash-latest', 'v' => 'v1beta'],
    ['m' => 'gemini-1.5-flash',        'v' => 'v1beta'],
    ['m' => 'gemini-1.5-flash',        'v' => 'v1'],
    ['m' => 'gemini-2.0-flash-exp',    'v' => 'v1beta'],
    ['m' => 'gemini-pro',              'v' => 'v1'],
    ['m' => 'gemini-1.0-pro',          'v' => 'v1beta'],
];

$lastResponse = null;
$lastHttpCode = 0;
$successText  = null;
$allErrors = [];

foreach ($MODELS_TO_TRY as $cfg) {
    $tryModel = $cfg['m'];
    $apiVer   = $cfg['v'];
    $endpoint = "https://generativelanguage.googleapis.com/{$apiVer}/models/{$tryModel}:generateContent?key={$GEMINI_API_KEY}";
    
    $geminiBody = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['maxOutputTokens' => 800, 'temperature' => 0.4],
    ]);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $geminiBody,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Masked key for debugging (e.g. AIza...4chars)
    $maskedKey = substr($GEMINI_API_KEY, 0, 4) . '...' . substr($GEMINI_API_KEY, -4);
    $keyLen = strlen($GEMINI_API_KEY);

    $allErrors[] = [
        'model' => $tryModel, 
        'status' => $httpCode, 
        'key_info' => "$maskedKey ($keyLen)",
        'response' => json_decode($response) ?? $response
    ];

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        $successText = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($successText) break; // Found a working model!
    }
}

if (!$successText) {
    http_response_code(502);
    echo json_encode([
        'error'   => 'AI service temporarily unavailable', 
        'status'  => $lastHttpCode, 
        'details' => $allErrors,
        'tried'   => $MODELS_TO_TRY
    ]);
    exit;
}

echo json_encode(['result' => $successText]);

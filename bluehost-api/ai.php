<?php
/**
 * MediLens Multi-Mode AI Proxy
 * Location: /public_html/medilens/api/ai.php
 * 
 * Redundancy: Tries Gemini (multiple models) -> Fallback to Groq.
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

// ── Credentials ───────────────────────────────────────────────────────────────
// These are replaced during GitHub Action deployment or read from environment
$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: 'YOUR_GEMINI_KEY_HERE';
$GROQ_API_KEY   = getenv('GROQ_API_KEY')   ?: 'YOUR_GROQ_KEY_HERE';

$ALLOWED_TASKS = [
    'country_narrative',
    'equivalence',
    'policy_brief',
    'appeal_letter',
    'drug_summary',
    'drug_country_analysis',
];

// ── Parse body ─────────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
if (strlen($raw) > 16384) {
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
            "You are a pharmaceutical policy analyst. Write a 2-paragraph summary for %s, covering: " .
            "(1) drug access state & registration lags, (2) pricing compared to global averages. " .
            "Be factual and professional. Data: %s",
            $payload['country_name'] ?? 'the region',
            json_encode($payload['data'] ?? [])
        ),
        'equivalence' => sprintf(
            "You are a clinical pharmacist. A patient in %s cannot access %s. " .
            "List 3 therapeutic alternatives available there. Be concise.",
            $payload['country'] ?? 'their country',
            $payload['drug'] ?? 'this drug'
        ),
        'policy_brief' => sprintf(
            "Write a 300-word policy brief for %s in %s. Focus on the access gap and clinical necessity. " .
            "Include 'Recommendation' and 'Evidence' sections.",
            $payload['drug'] ?? 'this medicine',
            $payload['country'] ?? 'this market'
        ),
        'appeal_letter' => sprintf(
            "Write a professional insurance appeal letter for %s. " .
            "Patient context: %s. Use a firm, clinical tone.",
            $payload['drug'] ?? 'this drug',
            $payload['patient_info'] ?? 'standard patient case'
        ),
        'drug_country_analysis' => sprintf(
            "Analyze the access landscape for %s in %s. Discuss registration delays and clinical impact. " .
            "Break into short readable sections.",
            $payload['drug'] ?? 'this drug',
            $payload['country'] ?? 'this country'
        ),
        'drug_summary' => sprintf(
            "Explain what %s is (therapeutic class and primary use) for a general audience. Max 2 sentences.",
            $payload['inn'] ?? 'this drug'
        ),
        default => "Provide pharmaceutical intelligence on the requested topic."
    };
}

$prompt = build_prompt($task, $payload);

// ── Providers ────────────────────────────────────────────────────────────────
function call_gemini($prompt, $apiKey) {
    if (!$apiKey || $apiKey === 'YOUR_GEMINI_KEY_HERE') return null;

    $models = [
        ['m' => 'gemini-flash-latest',     'v' => 'v1beta'],
        ['m' => 'gemini-1.5-flash-latest', 'v' => 'v1beta'],
        ['m' => 'gemini-1.5-flash',        'v' => 'v1beta'],
    ];

    foreach ($models as $cfg) {
        $url = "https://generativelanguage.googleapis.com/{$cfg['v']}/models/{$cfg['m']}:generateContent?key={$apiKey}";
        $data = json_encode([
            'contents'         => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['maxOutputTokens' => 1000, 'temperature' => 0.4]
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $data,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 15
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200) {
            $json = json_decode($res, true);
            $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($text) return $text;
        }
    }
    return null;
}

function call_groq($prompt, $apiKey) {
    if (!$apiKey || $apiKey === 'YOUR_GROQ_KEY_HERE') return null;

    $url = "https://api.groq.com/openai/v1/chat/completions";
    $data = json_encode([
        'model' => 'llama-3.1-8b-instant',
        'messages' => [['role' => 'user', 'content' => $prompt]],
        'temperature' => 0.4,
        'max_tokens' => 1000
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $data,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            "Authorization: Bearer $apiKey"
        ],
        CURLOPT_TIMEOUT        => 15
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200) {
        $json = json_decode($res, true);
        return $json['choices'][0]['message']['content'] ?? null;
    }
    return null;
}

// ── Execution Loop ───────────────────────────────────────────────────────────
$result = call_gemini($prompt, $GEMINI_API_KEY);

if (!$result) {
    $result = call_groq($prompt, $GROQ_API_KEY);
    $source = 'Groq';
} else {
    $source = 'Gemini';
}

if (!$result) {
    http_response_code(502);
    echo json_encode(['error' => 'All AI providers exhausted. Please check API keys.']);
    exit;
}

echo json_encode(['result' => $result, 'provider' => $source]);

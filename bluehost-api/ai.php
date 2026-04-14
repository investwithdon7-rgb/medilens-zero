<?php
/**
 * MediLens AI Proxy - Final Forced Version
 */

$origin = $_SERVER['HTTP_ORIGIN'] ?? 'https://tekdruid.com';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

ini_set('display_errors', 0);
error_reporting(E_ALL);

$GEMINI_API_KEY = trim(getenv('GEMINI_API_KEY') ?: 'YOUR_GEMINI_KEY_HERE');
$GROQ_API_KEY   = trim(getenv('GROQ_API_KEY')   ?: 'YOUR_GROQ_KEY_HERE');

$DEBUG_LOG = [];
$DEBUG_LOG[] = "Init: Forced. G_len=".strlen($GEMINI_API_KEY).", Gr_len=".strlen($GROQ_API_KEY);

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || !isset($body['task'], $body['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload', 'debug' => $DEBUG_LOG]);
    exit;
}

$task = $body['task'];
$payload = $body['payload'];
$prompt = "Explain " . ($payload['inn'] ?? $payload['drug'] ?? 'this drug') . " in 2 sentences.";

$final_result = null;
$source = null;

// ── Gemini ──────────────────────────────────────────────────────────────────
$DEBUG_LOG[] = "Entering Gemini block...";
if (strlen($GEMINI_API_KEY) > 25) {
    $model = 'gemini-flash-latest';
    $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$GEMINI_API_KEY";
    $postData = json_encode(['contents' => [['parts' => [['text' => $prompt]]]]]);
    
    $options = [
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\n",
            'content' => $postData,
            'ignore_errors' => true,
            'timeout' => 15
        ]
    ];
    
    $context = stream_context_create($options);
    $res = file_get_contents($url, false, $context);
    $status = $http_response_header[0] ?? 'Unknown Status';
    $DEBUG_LOG[] = "Gemini Result: $status";
    
    if (strpos($status, '200') !== false) {
        $json = json_decode($res, true);
        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($text) {
            $final_result = $text;
            $source = "Gemini";
        }
    }
}

// ── Groq ───────────────────────────────────────────────────────────────────
if (!$final_result) {
    $DEBUG_LOG[] = "Entering Groq block...";
    if (strlen($GROQ_API_KEY) > 25) {
        $url = "https://api.groq.com/openai/v1/chat/completions";
        $postData = json_encode([
            'model' => 'llama-3.1-8b-instant',
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'temperature' => 0.4
        ]);
        
        $options = [
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/json\r\n" .
                             "Authorization: Bearer $GROQ_API_KEY\r\n",
                'content' => $postData,
                'ignore_errors' => true,
                'timeout' => 15
            ]
        ];
        
        $context = stream_context_create($options);
        $res = file_get_contents($url, false, $context);
        $status = $http_response_header[0] ?? 'Unknown Status';
        $DEBUG_LOG[] = "Groq Result: $status";
        
        if (strpos($status, '200') !== false) {
            $json = json_decode($res, true);
            $text = $json['choices'][0]['message']['content'] ?? null;
            if ($text) {
                $final_result = $text;
                $source = "Groq";
            }
        }
    }
}

if ($final_result) {
    echo json_encode(['result' => $final_result, 'provider' => $source, 'debug' => $DEBUG_LOG]);
} else {
    http_response_code(502);
    echo json_encode(['error' => 'Both providers failed', 'debug' => $DEBUG_LOG]);
}

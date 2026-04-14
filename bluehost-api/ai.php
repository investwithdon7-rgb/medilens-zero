<?php
/**
 * MediLens AI Proxy - Linear Version
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

// ── Credentials ───────────────────────────────────────────────────────────────
$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: 'YOUR_GEMINI_KEY_HERE';
$GROQ_API_KEY   = getenv('GROQ_API_KEY')   ?: 'YOUR_GROQ_KEY_HERE';

$DEBUG_LOG = [];
$DEBUG_LOG[] = "Init: Gemini(".strlen($GEMINI_API_KEY)."), Groq(".strlen($GROQ_API_KEY).")";

// ── Parse Body ────────────────────────────────────────────────────────────────
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || !isset($body['task'], $body['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request', 'debug' => $DEBUG_LOG]);
    exit;
}

$task = $body['task'];
$payload = $body['payload'];

// ── Build Prompt ──────────────────────────────────────────────────────────────
$prompt = "Provide pharmaceutical intelligence for task: " . $task . ". ";
if ($task === 'drug_summary') {
    $prompt = "Explain what " . ($payload['inn'] ?? 'this drug') . " is (therapeutic class and primary use) precisely in 2 sentences.";
} else if ($task === 'policy_brief' || $task === 'drug_country_analysis' || $task === 'country_narrative') {
    $prompt = "Analyze drug access for " . ($payload['drug'] ?? $payload['inn'] ?? 'the drug') . " in " . ($payload['country'] ?? $payload['country_name'] ?? 'the market') . ". " .
              "Focus on registration lags and pricing. Data: " . json_encode($payload['data'] ?? []);
} else {
    $prompt = "Analyze: " . json_encode($payload);
}

// ── Attempt 1: Gemini ─────────────────────────────────────────────────────────
$final_result = null;
$source = null;

if ($GEMINI_API_KEY && $GEMINI_API_KEY !== 'YOUR_GEMINI_KEY_HERE') {
    $models = ['gemini-flash-latest', 'gemini-1.5-flash'];
    foreach ($models as $m) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/$m:generateContent?key=$GEMINI_API_KEY";
        $postData = json_encode(['contents' => [['parts' => [['text' => $prompt]]]]]);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        
        $DEBUG_LOG[] = "Gemini($m): Code $code" . ($err ? " Error: $err" : "");
        
        if ($code === 200) {
            $json = json_decode($res, true);
            $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($text) {
                $final_result = $text;
                $source = "Gemini ($m)";
                break;
            }
        }
    }
}

// ── Attempt 2: Groq ───────────────────────────────────────────────────────────
if (!$final_result && $GROQ_API_KEY && $GROQ_API_KEY !== 'YOUR_GROQ_KEY_HERE') {
    $url = "https://api.groq.com/openai/v1/chat/completions";
    $postData = json_encode([
        'model' => 'llama-3.1-8b-instant',
        'messages' => [['role' => 'user', 'content' => $prompt]],
        'temperature' => 0.4
    ]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $GROQ_API_KEY
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    $DEBUG_LOG[] = "Groq: Code $code" . ($err ? " Error: $err" : "");
    
    if ($code === 200) {
        $json = json_decode($res, true);
        $text = $json['choices'][0]['message']['content'] ?? null;
        if ($text) {
            $final_result = $text;
            $source = "Groq (llama-3.1)";
        }
    }
}

// ── Output ────────────────────────────────────────────────────────────────────
if ($final_result) {
    echo json_encode([
        'result' => $final_result,
        'provider' => $source,
        'debug' => $DEBUG_LOG
    ]);
} else {
    http_response_code(502);
    echo json_encode([
        'error' => 'AI generation failed',
        'debug' => $DEBUG_LOG
    ]);
}

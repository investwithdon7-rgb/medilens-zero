<?php
header('Content-Type: application/json');

$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: 'KEY_NOT_FOUND';
$MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-pro'];

$results = [];

foreach ($MODELS as $m) {
    $url = "https://generativelanguage.googleapis.com/v1/models/{$m}:generateContent?key={$GEMINI_API_KEY}";
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['contents' => [['parts' => [['text' => 'hi']]]]]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errNum   = curl_errno($ch);
    $errMsg   = curl_error($ch);
    curl_close($ch);
    
    $results[$m] = [
        'code' => $httpCode,
        'curl_error' => $errMsg,
        'response' => json_decode($response, true) ?: $response
    ];
}

echo json_encode([
    'key_prefix' => substr($GEMINI_API_KEY, 0, 5),
    'results' => $results
]);
?>

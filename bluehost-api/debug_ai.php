<?php
header('Content-Type: application/json');

$GEMINI_API_KEY = 'YOUR_GEMINI_KEY_HERE';

$url = "https://generativelanguage.googleapis.com/v1beta/models?key={$GEMINI_API_KEY}";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode([
    'code' => $httpCode,
    'key_prefix' => substr($GEMINI_API_KEY, 0, 5),
    'models' => json_decode($response, true)
]);
exit;
?>

<?php
/**
 * MediLens ClinicalTrials.gov API CORS Proxy
 * Safely forwards query requests to the official US NIH ClinicalTrials.gov REST APIv2.
 */

// Allow CORS from our domains and localhost for development
$allowed_origins = [
    'https://tekdruid.com',
    'https://www.tekdruid.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
];

$request_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$cors_origin = in_array($request_origin, $allowed_origins, true) ? $request_origin : 'https://tekdruid.com';

header("Access-Control-Allow-Origin: $cors_origin");
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed. Only GET and OPTIONS requests are supported.']));
}

// Rebuild the query parameters securely
$query_params = [];
$allowed_params = [
    'pageSize', 'pageCursor', 'query.term', 'filter.phases', 'filter.overallStatus'
];

foreach ($allowed_params as $param) {
    if (isset($_GET[$param])) {
        // Enforce basic query sanitization
        $query_params[$param] = preg_replace('/[\x00-\x1F\x7F]/', '', trim((string)$_GET[$param]));
    }
}

// Build destination URL
$target_url = 'https://clinicaltrials.gov/api/v2/studies';
if (!empty($query_params)) {
    $target_url .= '?' . http_build_query($query_params);
}

// Execute the request via cURL (safer and cleaner on shared hosting environments like Bluehost)
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_USERAGENT, 'MediLensAdvocacyPlatform/1.0 (https://tekdruid.com/medilens/)');

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Bad Gateway: Failed to contact ClinicalTrials.gov API.',
        'details' => $curl_err
    ]);
    exit;
}

http_response_code($http_code);
echo $response;

<?php
header('Content-Type: text/plain');
echo "MediLens Path Probe\n";
echo "===================\n";
echo "Current File: " . __FILE__ . "\n";
echo "Current Dir: " . getcwd() . "\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Request URI: " . $_SERVER['REQUEST_URI'] . "\n";
?>

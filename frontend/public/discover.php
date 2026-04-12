<?php
header('Content-Type: text/plain');
echo "Directory Discovery\n";
echo "===================\n";
echo "Current Dir: " . getcwd() . "\n";

function list_dirs($path) {
    if (!is_dir($path)) return;
    $items = scandir($path);
    foreach ($items as $item) {
        if ($item == "." || $item == "..") continue;
        if (is_dir($path . "/" . $item)) {
            echo "[DIR] " . $path . "/" . $item . "\n";
        } else {
            echo "[FILE] " . $path . "/" . $item . "\n";
        }
    }
}

echo "Contents of .. (Parent):\n";
list_dirs("..");

echo "\nContents of . (Current):\n";
list_dirs(".");
?>

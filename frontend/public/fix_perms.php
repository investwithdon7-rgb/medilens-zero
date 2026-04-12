<?php
header('Content-Type: text/plain');
echo "MediLens Permissions Fixer\n";
echo "=========================\n";

function fix_permissions($path) {
    if (!file_exists($path)) return;
    
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    // Fix current directory
    chmod($path, 0755);
    echo "CHMOD 755: $path\n";

    foreach ($items as $item) {
        $p = $item->getPathname();
        if ($item->isDir()) {
            if (chmod($p, 0755)) {
                echo "CHMOD 755 (DIR): $p\n";
            }
        } else {
            if (chmod($p, 0644)) {
                echo "CHMOD 644 (FILE): $p\n";
            }
        }
    }
}

fix_permissions(getcwd());
echo "\nFinished fixing permissions.\n";
?>

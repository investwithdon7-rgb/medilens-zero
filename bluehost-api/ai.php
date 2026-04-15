<?php
/**
 * MediLens AI Proxy
 * Routes each task type to a purpose-built expert prompt.
 * Providers: Gemini (primary) → Groq Llama (fallback)
 */

$origin = $_SERVER['HTTP_ORIGIN'] ?? 'https://tekdruid.com';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Medilens-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

ini_set('display_errors', 0);
error_reporting(E_ALL);

// ── Secrets ───────────────────────────────────────────────────────────────────
if (file_exists(__DIR__ . '/secrets.php')) {
    include_once __DIR__ . '/secrets.php';
}

$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: ($_SERVER['GEMINI_API_KEY'] ?? null);
$GROQ_API_KEY   = getenv('GROQ_API_KEY')   ?: ($_SERVER['GROQ_API_KEY']   ?? null);
$PROXY_TOKEN    = getenv('MEDILENS_PROXY_TOKEN') ?: ($_SERVER['MEDILENS_PROXY_TOKEN'] ?? null);

if (!$GEMINI_API_KEY || !$GROQ_API_KEY || !$PROXY_TOKEN) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error: Missing API keys or proxy token.']);
    exit;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
$client_token = $_SERVER['HTTP_X_MEDILENS_TOKEN'] ?? '';
if ($client_token !== $PROXY_TOKEN) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden: Invalid proxy token']));
}

$DEBUG_LOG = [];

// ── Parse input ───────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || !isset($body['task'], $body['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload', 'debug' => $DEBUG_LOG]);
    exit;
}

$task    = $body['task'];
$payload = $body['payload'];

// ── Extract common fields ─────────────────────────────────────────────────────
$drugName    = $payload['drug']    ?? $payload['inn']     ?? 'this drug';
$country     = $payload['country'] ?? 'the target country';
$drugClass   = $payload['drug_class']   ?? '';
$isEssential = $payload['is_essential'] ?? false;
$incomeClass = $payload['income_class'] ?? '';
$approvals   = $payload['approvals']    ?? [];
$stats       = $payload['stats']        ?? [];
$gapData     = $payload['gap_data']     ?? null;
$aiAnalytics = $payload['ai_analytics'] ?? null;
$data        = $payload['data']         ?? [];

$totalApproved  = $data['total_approved']  ?? count(array_filter((array)$approvals, fn($a) => !empty($a['approval_date'])));
$totalCountries = $data['total_countries'] ?? count((array)$approvals);
$avgLagDays     = $data['avg_lag_days']    ?? null;
$avgLagYears    = $avgLagDays ? round($avgLagDays / 365, 1) : null;

$firstApproval  = !empty($approvals) ? ($approvals[0]['country'] ?? 'unknown') : 'unknown';
$firstDate      = !empty($approvals) && !empty($approvals[0]['approval_date'])
    ? $approvals[0]['approval_date']
    : 'unknown date';

$currentDate = date('F Y');
$essentialLabel = $isEssential ? ' (WHO Essential Medicine)' : '';

$DEBUG_LOG[] = "Task: $task | Drug: $drugName | Country: $country";

// ── Build task-specific expert prompt ─────────────────────────────────────────

switch ($task) {

    // ── POLICY BRIEF ─────────────────────────────────────────────────────────
    case 'policy_brief':
        $notRegistered = $totalCountries - $totalApproved;
        $prompt = <<<PROMPT
You are a senior WHO health economist writing a policy brief for a Minister of Health or parliamentary health committee.

DRUG: $drugName$essentialLabel
CLASS: $drugClass
FIRST GLOBAL APPROVAL: $firstDate (in $firstApproval)
TOTAL COUNTRIES APPROVED: $totalApproved / $totalCountries tracked
UNREGISTERED COUNTRIES: $notRegistered
AVERAGE APPROVAL LAG: {$avgLagYears} years (where data exists)
DATE: $currentDate

Write a structured 250-word policy brief with EXACTLY these four sections:

1. PUBLIC HEALTH IMPACT
   — Estimated patient population affected by the access gap
   — Clinical consequence of this delay (mortality, morbidity, quality of life)
   — Any WHO EML or TRIPS relevance

2. ROOT CAUSE OF THE GAP
   — Identify the primary barrier: patent, affordability, regulatory capacity, or manufacturer choice
   — Reference comparable countries that have already registered this drug

3. RECOMMENDED POLICY ACTIONS (3 specific, actionable steps)
   — Each with a precedent from a country that successfully addressed a similar gap
   — One must be achievable within 12 months

4. SUCCESS METRIC
   — One measurable 12-month milestone to track progress

Tone: formal, data-driven, evidence-based. No preamble or summary sentence.
PROMPT;
        break;

    // ── APPEAL LETTER ─────────────────────────────────────────────────────────
    case 'appeal_letter':
        $alts = '';
        if (!empty($aiAnalytics['alternatives'])) {
            $alts = implode(', ', (array)$aiAnalytics['alternatives']);
        }
        $prompt = <<<PROMPT
You are a clinical pharmacist writing a formal insurance reimbursement appeal to an insurer or national formulary board.

DRUG: $drugName$essentialLabel
CLASS: $drugClass
APPROVED IN: $totalApproved countries globally (first approved: $firstDate)
THERAPEUTIC ALTERNATIVES ON FORMULARY: $alts
DATE: $currentDate

Write a 220-word clinical justification letter with EXACTLY these four sections:

1. CLINICAL NECESSITY
   — Why this specific drug is required over available alternatives
   — Mechanism of action and therapeutic differentiation
   — Patient population this applies to

2. EVIDENCE BASE
   — Phase 3 trial outcomes (use known published data or state "pending confirmation")
   — Regulatory approval basis (FDA/EMA approval type if known)
   — Comparative effectiveness vs listed alternatives

3. COST-EFFECTIVENESS CASE
   — QALY gain estimate if known, or reference national HTA assessment
   — Cost of not treating: hospitalisation, disease progression, productivity loss

4. REQUEST
   — Specific ask: formulary inclusion, individual funding approval, or prior authorisation waiver
   — Proposed monitoring parameters

Tone: formal medical language, suitable for a clinical review board. No salutation or sign-off.
PROMPT;
        break;

    // ── DRUG–COUNTRY ANALYSIS ─────────────────────────────────────────────────
    case 'drug_country_analysis':
        $gapFirstApproved = '';
        $gapAuthority = '';
        $gapCondition = '';
        if (is_array($gapData)) {
            $gapFirstApproved = $gapData['first_approved'] ?? '';
            $gapAuthority     = $gapData['authority']     ?? '';
            $gapCondition     = $gapData['condition']     ?? '';
        }
        $gapLagYears = $gapFirstApproved
            ? round((time() - strtotime($gapFirstApproved)) / (365.25 * 24 * 3600), 1)
            : null;

        $prompt = <<<PROMPT
You are a global pharmaceutical access analyst. Provide a sharp, fact-based access gap analysis.

DRUG: $drugName ($gapCondition)
COUNTRY: $country ($incomeClass)
FIRST APPROVED GLOBALLY: $gapFirstApproved ($gapAuthority)
CURRENT STATUS IN $country: NOT REGISTERED
ACCESS GAP: {$gapLagYears} years since global first approval
DATE: $currentDate

IMPORTANT: Cross-reference your training knowledge. If our database date appears incorrect for a long-established drug,
state the historical reality while acknowledging the reported date may refer to a new indication or formulation.

Write a 200-word structured analysis with EXACTLY these four sections:

DRUG PROFILE
Brief clinical role, therapeutic class, and why it matters for patients in $country.

REGISTRATION LAG
Real access gap duration. Why has $country not registered this drug? Likely barrier type
(patent, affordability, regulatory capacity, manufacturer choice).

ECONOMIC BARRIER
Price context for $country's income level ($incomeClass). Is this reimbursable under national
health insurance? Generic availability status.

ADVOCACY VIEW
One concrete step an NGO, patient group, or Ministry of Health in $country could take today.
Include a comparable country that successfully closed a similar gap.

Keep factual, concise, and free of filler phrases.
PROMPT;
        break;

    // ── COUNTRY NARRATIVE ─────────────────────────────────────────────────────
    case 'country_narrative':
        $drugsBehind   = $stats['drugs_behind_2yr']          ?? 0;
        $newUnreg      = $stats['new_drugs_not_registered']  ?? 0;
        $pricePct      = $stats['pricing_percentile']        ?? null;
        $shortageRisk  = $stats['shortage_risk_high']        ?? 0;
        $pricePctLabel = $pricePct !== null ? "${pricePct}th percentile" : 'unknown';

        $prompt = <<<PROMPT
You are a senior pharmaceutical access consultant writing a country intelligence briefing for a global health NGO.

COUNTRY: $country ($incomeClass)
DRUGS >2 YEARS BEHIND GLOBAL APPROVAL: $drugsBehind
NEW DRUGS NOT YET REGISTERED: $newUnreg
PRICING RANK: $pricePctLabel globally for essential medicines basket
HIGH SHORTAGE RISK DRUGS: $shortageRisk
DATE: $currentDate

Write a 280-word country pharmaceutical access briefing with EXACTLY these five sections:

REGULATORY OVERVIEW
Regulatory authority, WHO membership, mutual recognition agreements, average approval timeline
compared to FDA/EMA.

ACCESS GAP PROFILE
Key numbers in context. What types of drugs are most delayed? Which therapeutic areas are worst affected?

PRICING & AFFORDABILITY
Is this country a high-cost or low-cost market relative to income? Key reimbursement mechanisms.
Are essential medicines affordable to average citizens?

SUPPLY CHAIN RISK
Single-source dependency risks. Local manufacturing capacity. Import vulnerability.

PRIORITY RECOMMENDATIONS (3 specific actions)
For the Ministry of Health, national regulatory agency, or procurement body.
Each grounded in precedent from a comparable country.

Tone: analytical, evidence-based, written for a senior audience. No generic filler.
PROMPT;
        break;

    // ── EQUIVALENCE ANALYSIS ──────────────────────────────────────────────────
    case 'equivalence':
        $alts = '';
        if (!empty($aiAnalytics['alternatives'])) {
            $alts = implode(', ', (array)$aiAnalytics['alternatives']);
        }

        $prompt = <<<PROMPT
You are a clinical pharmacist comparing therapeutic equivalents for a prescriber or health technology assessor.

PRIMARY DRUG: $drugName ($drugClass)
ALTERNATIVES TO COMPARE: $alts
CONTEXT COUNTRY: $country
DATE: $currentDate

Write a structured 250-word therapeutic equivalence analysis covering:

1. MECHANISM COMPARISON
Compare the primary drug to each alternative: mechanism of action, receptor selectivity,
pharmacokinetic differences (half-life, route, renal/hepatic considerations).

2. CLINICAL OUTCOMES
Head-to-head trial data where available. Efficacy endpoints (response rate, survival, HbA1c, etc.).
Safety profile differences. Patient subgroups where one agent is preferred.

3. ACCESS & AFFORDABILITY COMPARISON
Generic availability for each agent. Approximate relative cost (%, not absolute).
Which alternative has widest global availability?

4. SUBSTITUTION RECOMMENDATION
In the absence of $drugName (e.g., not registered in $country), which alternative is most
appropriate, for which patients, and with what monitoring requirements?

Be specific and clinical. Avoid vague language. Cite drug class or mechanism rather than brand names.
PROMPT;
        break;

    // ── SHORTAGE RISK ─────────────────────────────────────────────────────────
    case 'shortage_risk':
        $drugsBehind  = $stats['drugs_behind_2yr']         ?? '';
        $shortageHigh = $stats['shortage_risk_high']       ?? 0;

        $prompt = <<<PROMPT
You are a supply chain analyst for a national medicines procurement agency or WHO regional office.

DRUG / CONTEXT: $drugName in $country ($incomeClass)
APPROVED IN: $totalApproved countries globally
DRUGS AT HIGH SHORTAGE RISK IN THIS COUNTRY: $shortageHigh
DATE: $currentDate

Write a 220-word supply chain risk assessment with EXACTLY these four sections:

SUPPLY CHAIN PROFILE
Number of known global manufacturers (WHO-PQ listed where relevant). API source countries.
Is this drug locally manufactured in $country, or entirely imported?

RISK FACTORS (rank top 3)
Score each: manufacturer concentration, import dependency, demand volatility, regulatory hold risk.
State overall risk level: LOW / MEDIUM / HIGH / CRITICAL.

SHORTAGE HISTORY
Known or likely past stockout events (based on drug class and country). Seasonal demand patterns.
Any recent regulatory quality holds or manufacturer exits in this class?

PROCUREMENT RECOMMENDATIONS
— Recommended strategic buffer stock (months of supply)
— Diversification strategy (alternative manufacturers, regional pooled procurement)
— One concrete action to reduce supply dependency within 6 months

Be specific. Use known procurement frameworks (UNICEF SD, Global Fund, CHAI) where relevant.
PROMPT;
        break;

    // ── ADVOCACY ACTION PLAN ──────────────────────────────────────────────────
    case 'advocacy_plan':
        $drugsBehind = $stats['drugs_behind_2yr']         ?? 0;
        $newUnreg    = $stats['new_drugs_not_registered'] ?? 0;

        $prompt = <<<PROMPT
You are an experienced pharmaceutical access advocate helping a patient group or NGO in $country.

COUNTRY: $country ($incomeClass)
DRUG / FOCUS: $drugName ($drugClass)
DRUGS BEHIND >2 YEARS: $drugsBehind
NEW DRUGS NOT REGISTERED: $newUnreg
DATE: $currentDate

Write a concrete 260-word advocacy action plan with EXACTLY these five sections:

WHO TO CONTACT
3 specific decision-makers: name the role (e.g., "Director General, National Medicines Authority"),
the relevant government department, and any international body (WHO, UNICEF, MSF) relevant to this gap.

KEY MESSAGES (3 bullet points)
Data-backed, human-centred messages that work for media, government, and public audiences.
Each under 30 words.

INTERNATIONAL FRAMEWORKS TO CITE
Relevant TRIPS flexibilities, WHO resolutions, UN SDG3 targets, or regional agreements
(AfCFTA, ASEAN, AU Agenda 2063) that support the advocacy claim.

COMPARABLE SUCCESS STORY
Name one country that closed a similar gap. How did they do it? What was the timeline?
Use this as a precedent argument.

DRAFT SOCIAL POST (3 versions, under 280 characters each)
- One factual/data post
- One human-story hook
- One call-to-action post

Tone: actionable, empowering, grounded in evidence. Suitable for advocates with no medical background.
PROMPT;
        break;

    // ── FALLBACK ──────────────────────────────────────────────────────────────
    default:
        $prompt = <<<PROMPT
As a global medicine intelligence expert, provide a Strategic Access Analysis for $drugName in $country.
TODAY'S DATE: $currentDate

CONTEXT:
- Drug class: $drugClass
- Approved in $totalApproved / $totalCountries tracked countries
- First approved: $firstDate ($firstApproval)

Write a 200-word structured analysis covering:
DRUG PROFILE | REGISTRATION LAG | ECONOMIC BARRIER | ADVOCACY VIEW

Keep factual, concise, and data-grounded.
PROMPT;
}

// ── Call AI providers ─────────────────────────────────────────────────────────
$final_result = null;
$source       = null;

// ── Gemini ────────────────────────────────────────────────────────────────────
$DEBUG_LOG[] = "Calling Gemini...";
if (strlen($GEMINI_API_KEY) > 25) {
    $model   = 'gemini-2.0-flash';
    $url     = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$GEMINI_API_KEY}";
    $postData = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 900],
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method'         => 'POST',
            'header'         => "Content-Type: application/json\r\n",
            'content'        => $postData,
            'ignore_errors'  => true,
            'timeout'        => 20,
        ],
    ]);

    $res    = file_get_contents($url, false, $ctx);
    $status = $http_response_header[0] ?? 'Unknown';
    $DEBUG_LOG[] = "Gemini: $status";

    if (strpos($status, '200') !== false) {
        $json = json_decode($res, true);
        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($text) { $final_result = trim($text); $source = 'Gemini'; }
    }
}

// ── Groq fallback ─────────────────────────────────────────────────────────────
if (!$final_result) {
    $DEBUG_LOG[] = "Falling back to Groq...";
    if (strlen($GROQ_API_KEY) > 25) {
        $url      = 'https://api.groq.com/openai/v1/chat/completions';
        $postData = json_encode([
            'model'       => 'llama-3.1-8b-instant',
            'messages'    => [['role' => 'user', 'content' => $prompt]],
            'temperature' => 0.4,
            'max_tokens'  => 900,
        ]);

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => "Content-Type: application/json\r\nAuthorization: Bearer {$GROQ_API_KEY}\r\n",
                'content'       => $postData,
                'ignore_errors' => true,
                'timeout'       => 20,
            ],
        ]);

        $res    = file_get_contents($url, false, $ctx);
        $status = $http_response_header[0] ?? 'Unknown';
        $DEBUG_LOG[] = "Groq: $status";

        if (strpos($status, '200') !== false) {
            $json = json_decode($res, true);
            $text = $json['choices'][0]['message']['content'] ?? null;
            if ($text) { $final_result = trim($text); $source = 'Groq'; }
        }
    }
}

// ── Respond ───────────────────────────────────────────────────────────────────
if ($final_result) {
    echo json_encode(['result' => $final_result, 'provider' => $source, 'debug' => $DEBUG_LOG]);
} else {
    http_response_code(502);
    echo json_encode(['error' => 'Both AI providers failed', 'debug' => $DEBUG_LOG]);
}

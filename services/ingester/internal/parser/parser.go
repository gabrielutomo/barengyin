package parser

import (
	"regexp"
	"strconv"
	"strings"
)

// ParsedTransaction represents structured transaction data extracted from bank notification
type ParsedTransaction struct {
	Amount     float64 `json:"amount"`
	Title      string  `json:"title"`
	Type       string  `json:"type"` // "expense" | "income"
	Category   string  `json:"category"`
	SourceBank string  `json:"source_bank"`
	Success    bool    `json:"success"`
	RawText    string  `json:"raw_text"`
}

type BankRule struct {
	BankName    string
	PkgPattern  string
	RegexList   []*regexp.Regexp
	AmountIndex int
	TitleIndex  int
	DefaultType string
}

var (
	// Clean non-digits for rupiah parsing
	reRupiahDigits = regexp.MustCompile(`[^\d]`)

	// Universal fallback regexes
	reUniversalAmount   = regexp.MustCompile(`(?i)(?:rp\.?|idr)\s*([\d\.,]{3,})`)
	reUniversalMerchant = regexp.MustCompile(`(?i)(?:di|ke|kepada|merchant|toko|outlet)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\s+sebesar|\s+menggunakan|\s+rp|\.|\,|$)`)
	reIncomeKeywords    = regexp.MustCompile(`(?i)(?:uang masuk|transfer masuk|dana masuk|menerima|diterima|top up|cashback|kredit)`)
)

func ParseRupiah(raw string) float64 {
	cleaned := strings.TrimSpace(raw)
	// Handle format like "45.000,00" -> "45000"
	if strings.Contains(cleaned, ",") {
		parts := strings.Split(cleaned, ",")
		cleaned = parts[0]
	}
	digitsOnly := reRupiahDigits.ReplaceAllString(cleaned, "")
	val, err := strconv.ParseFloat(digitsOnly, 64)
	if err != nil {
		return 0
	}
	return val
}

func CleanTitle(title string) string {
	cleaned := strings.TrimSpace(title)
	// Remove common trailing words
	cleaned = regexp.MustCompile(`(?i)\s+(berhasil|sukses|telah berhasil|menggunakan.*)$`).ReplaceAllString(cleaned, "")
	if len(cleaned) == 0 {
		return "Transaksi Bank"
	}
	// Limit length
	if len(cleaned) > 60 {
		cleaned = cleaned[:60]
	}
	return strings.Title(strings.ToLower(cleaned))
}

func DetectCategory(title string) string {
	lower := strings.ToLower(title)
	switch {
	case strings.Contains(lower, "kopi") || strings.Contains(lower, "cafe") || strings.Contains(lower, "resto") ||
		strings.Contains(lower, "makan") || strings.Contains(lower, "bakso") || strings.Contains(lower, "mie") ||
		strings.Contains(lower, "warung") || strings.Contains(lower, "mcd") || strings.Contains(lower, "kfc"):
		return "Makan & Kencan"
	case strings.Contains(lower, "indomaret") || strings.Contains(lower, "alfamart") || strings.Contains(lower, "supermarket") ||
		strings.Contains(lower, "groceries") || strings.Contains(lower, "pasar"):
		return "Groceries & Rumah"
	case strings.Contains(lower, "spbu") || strings.Contains(lower, "pertamina") || strings.Contains(lower, "shell") ||
		strings.Contains(lower, "gojek") || strings.Contains(lower, "grab") || strings.Contains(lower, "toll") ||
		strings.Contains(lower, "parkir") || strings.Contains(lower, "kereta") || strings.Contains(lower, "mrt"):
		return "Transportasi"
	case strings.Contains(lower, "cinema") || strings.Contains(lower, "xxi") || strings.Contains(lower, "cgv") ||
		strings.Contains(lower, "netflix") || strings.Contains(lower, "spotify") || strings.Contains(lower, "steam"):
		return "Hiburan & Nonton"
	case strings.Contains(lower, "pln") || strings.Contains(lower, "pdam") || strings.Contains(lower, "bpjs") ||
		strings.Contains(lower, "wifi") || strings.Contains(lower, "indihome") || strings.Contains(lower, "pulsa"):
		return "Tagihan & Utilitas"
	default:
		return "Lainnya"
	}
}

// ParseNotification parses raw bank notification text from any Indonesian bank/e-wallet
func ParseNotification(pkg, title, text string) ParsedTransaction {
	fullText := strings.TrimSpace(title + " " + text)

	result := ParsedTransaction{
		RawText:  text,
		Category: "Lainnya",
		Type:     "expense",
		Success:  false,
	}

	// 1. Detect Source Bank
	lowerPkg := strings.ToLower(pkg)
	lowerFull := strings.ToLower(fullText)
	switch {
	case strings.Contains(lowerPkg, "bca") || strings.Contains(lowerFull, "bca"):
		result.SourceBank = "BCA"
	case strings.Contains(lowerPkg, "mandiri") || strings.Contains(lowerPkg, "livin") || strings.Contains(lowerFull, "mandiri") || strings.Contains(lowerFull, "livin"):
		result.SourceBank = "Mandiri"
	case strings.Contains(lowerPkg, "brimo") || strings.Contains(lowerPkg, "bri") || strings.Contains(lowerFull, "brimo") || strings.Contains(lowerFull, "bri"):
		result.SourceBank = "BRI"
	case strings.Contains(lowerPkg, "bni") || strings.Contains(lowerFull, "bni") || strings.Contains(lowerFull, "wondr"):
		result.SourceBank = "BNI"
	case strings.Contains(lowerPkg, "jago") || strings.Contains(lowerFull, "bank jago"):
		result.SourceBank = "Bank Jago"
	case strings.Contains(lowerPkg, "seabank") || strings.Contains(lowerFull, "seabank"):
		result.SourceBank = "SeaBank"
	case strings.Contains(lowerPkg, "gopay") || strings.Contains(lowerPkg, "gojek") || strings.Contains(lowerFull, "gopay"):
		result.SourceBank = "GoPay"
	case strings.Contains(lowerPkg, "dana") || strings.Contains(lowerFull, "dana"):
		result.SourceBank = "DANA"
	case strings.Contains(lowerPkg, "ovo") || strings.Contains(lowerFull, "ovo"):
		result.SourceBank = "OVO"
	case strings.Contains(lowerPkg, "shopee") || strings.Contains(lowerFull, "shopeepay"):
		result.SourceBank = "ShopeePay"
	case strings.Contains(lowerPkg, "bluby") || strings.Contains(lowerFull, "blu bca"):
		result.SourceBank = "Blu BCA"
	default:
		result.SourceBank = "Bank / E-Wallet"
	}

	// 2. Detect Income vs Expense
	if reIncomeKeywords.MatchString(fullText) {
		result.Type = "income"
		result.Category = "Pemasukan & Top-up"
	}

	// 3. Specialized Regex Rules
	// Rule Set A: QRIS (Pattern: QRIS [Rp] [Amount] di [Merchant])
	reQris := regexp.MustCompile(`(?i)(?:transaksi\s+)?qris\s+(?:sebesar\s+)?(?:idr|rp\.?)?\s*([\d\.,]{3,})\s+(?:di|ke|kepada)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\.|$|\s+tgl|\s+pada)`)
	if matches := reQris.FindStringSubmatch(fullText); len(matches) >= 3 {
		result.Amount = ParseRupiah(matches[1])
		result.Title = CleanTitle("QRIS: " + matches[2])
		result.Category = DetectCategory(matches[2])
		result.Success = result.Amount > 0
		return result
	}

	// Rule Set B: Pembayaran / Transfer (Pattern: Pembayaran/Transfer [sebesar] [Rp] [Amount] ke/di [Merchant/Nama])
	reTransfer := regexp.MustCompile(`(?i)(?:pembayaran|transfer|bayar|kamu telah membayar)\s+(?:sebesar\s+)?(?:idr|rp\.?)?\s*([\d\.,]{3,})\s+(?:ke|di|kepada)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\.|$|\s+tgl|\s+pada)`)
	if matches := reTransfer.FindStringSubmatch(fullText); len(matches) >= 3 {
		result.Amount = ParseRupiah(matches[1])
		result.Title = CleanTitle(matches[2])
		result.Category = DetectCategory(matches[2])
		result.Success = result.Amount > 0
		return result
	}

	// Rule Set C: Debit Card (Pattern: Debit [Amount] di [Merchant])
	reDebit := regexp.MustCompile(`(?i)(?:transaksi\s+)?(?:kartu\s+)?debit\s+(?:sebesar\s+)?(?:idr|rp\.?)?\s*([\d\.,]{3,})\s+(?:di|ke)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\.|$|\s+tgl)`)
	if matches := reDebit.FindStringSubmatch(fullText); len(matches) >= 3 {
		result.Amount = ParseRupiah(matches[1])
		result.Title = CleanTitle("Debit: " + matches[2])
		result.Category = DetectCategory(matches[2])
		result.Success = result.Amount > 0
		return result
	}

	// 4. Universal Fallback (Bisa membaca format bank mana pun di Indonesia)
	if amountMatches := reUniversalAmount.FindStringSubmatch(fullText); len(amountMatches) >= 2 {
		result.Amount = ParseRupiah(amountMatches[1])

		if merchantMatches := reUniversalMerchant.FindStringSubmatch(fullText); len(merchantMatches) >= 2 {
			result.Title = CleanTitle(merchantMatches[1])
			result.Category = DetectCategory(merchantMatches[1])
		} else {
			result.Title = "Pembayaran " + result.SourceBank
		}

		result.Success = result.Amount > 0
		return result
	}

	return result
}

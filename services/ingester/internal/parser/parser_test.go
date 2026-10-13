package parser

import (
	"testing"
)

func TestParseNotification(t *testing.T) {
	tests := []struct {
		name       string
		pkg        string
		title      string
		text       string
		wantAmount float64
		wantBank   string
		wantType   string
	}{
		{
			name:       "BCA QRIS Kopi Kenangan",
			pkg:        "com.bca",
			title:      "BCA Mobile",
			text:       "Transaksi QRIS Rp 45.000 di Kopi Kenangan Sukses",
			wantAmount: 45000,
			wantBank:   "BCA",
			wantType:   "expense",
		},
		{
			name:       "Mandiri Livin QRIS",
			pkg:        "id.co.bankmandiri.livin",
			title:      "Livin' by Mandiri",
			text:       "Pembayaran QRIS sebesar IDR 78.500 ke Janji Jiwa berhasil",
			wantAmount: 78500,
			wantBank:   "Mandiri",
			wantType:   "expense",
		},
		{
			name:       "GoPay Pembayaran",
			pkg:        "com.gojek.app",
			title:      "Gojek",
			text:       "Pembayaran sebesar Rp 32.000 ke Warung Bu Siti berhasil",
			wantAmount: 32000,
			wantBank:   "GoPay",
			wantType:   "expense",
		},
		{
			name:       "BRImo QRIS",
			pkg:        "id.co.bri.brimo",
			title:      "BRImo",
			text:       "Transaksi QRIS BRImo berhasil! Pembayaran Rp 150.000 kepada Toko Elektronik Jaya",
			wantAmount: 150000,
			wantBank:   "BRI",
			wantType:   "expense",
		},
		{
			name:       "Bank Jago Kantong",
			pkg:        "com.jago.bank",
			title:      "Bank Jago",
			text:       "Kamu telah membayar Rp 25.000 menggunakan Kantong Jajan di Fore Coffee",
			wantAmount: 25000,
			wantBank:   "Bank Jago",
			wantType:   "expense",
		},
		{
			name:       "Universal Bank Lain (Misal Bank Nagari / BSI / Permata)",
			pkg:        "id.co.bsi.mobile",
			title:      "BSI Mobile",
			text:       "Transaksi berhasil di Indomaret Point sebesar Rp 54.000",
			wantAmount: 54000,
			wantType:   "expense",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ParseNotification(tt.pkg, tt.title, tt.text)
			if !res.Success {
				t.Errorf("ParseNotification() success = false, expected true for text: %s", tt.text)
			}
			if res.Amount != tt.wantAmount {
				t.Errorf("ParseNotification() amount = %v, want %v", res.Amount, tt.wantAmount)
			}
			if tt.wantBank != "" && res.SourceBank != tt.wantBank {
				t.Errorf("ParseNotification() bank = %v, want %v", res.SourceBank, tt.wantBank)
			}
			if res.Type != tt.wantType {
				t.Errorf("ParseNotification() type = %v, want %v", res.Type, tt.wantType)
			}
		})
	}
}

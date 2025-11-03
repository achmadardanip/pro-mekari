# Pro-Mekari Procurement Demo

Demo aplikasi **Smart ePengadaan Cerdas Mekari** yang dirancang berdasarkan dokumen "Smart ePengadaan Cerdas Mekari (2).pdf". Proyek ini mensimulasikan blueprint implementasi di platform **Mekari Officeless** dengan menyiapkan struktur data, logika matriks persetujuan dinamis, dan alur procure-to-pay end-to-end.

## Cara Menjalankan

1. Clone repositori ini dan buka folder `app/`.
2. Jalankan berkas `index.html` langsung di peramban modern (Chrome/Edge/Firefox). Tidak diperlukan server tambahan atau dependensi eksternal.
3. Data demo otomatis tersimpan di `localStorage` browser. Gunakan tombol **Reset Data Demo** pada tab *Konfigurasi* untuk mengembalikan kondisi awal.

## Fitur Utama

- **Manajemen Anggaran** – Membuat anggaran per departemen/kategori, memantau komitmen (PR) dan realisasi (PO/GR/Invoice) secara real-time. 【F:app/app.js†L259-L341】【F:app/data.js†L107-L169】
- **Direktori Vendor & Kategori** – Registrasi vendor, pemetaan kategori, serta perhitungan skor kualitas pemasok. 【F:app/app.js†L343-L393】【F:app/data.js†L46-L83】
- **Formulir PR Dinamis** – Pemohon memilih anggaran, vendor, kategori, dan menambahkan item dengan validasi saldo anggaran. 【F:app/app.js†L180-L257】
- **Matriks Persetujuan Cerdas** – Aturan multi-level (sekuensial & paralel) berdasarkan departemen, kategori, dan nilai transaksi. UI persetujuan menyediakan pemilihan approver sesuai peran yang ditetapkan. 【F:app/app.js†L116-L178】【F:app/app.js†L395-L519】【F:app/data.js†L170-L260】
- **Konversi PR → PO → GR → Invoice** – Simulasi proses procure-to-pay lengkap, termasuk pembaruan komitmen vs realisasi anggaran serta jejak audit. 【F:app/app.js†L521-L647】
- **Dasbor & Analitik** – Ringkasan KPI, tindakan prioritas, SLA persetujuan, dan cakupan vendor untuk memandu keputusan strategis. 【F:app/app.js†L649-L776】
- **Blueprint Officeless** – Tab konfigurasi menampilkan struktur entitas, mapping peran, dan matriks persetujuan dalam format JSON untuk diadaptasi ke Mekari Officeless (App Builder, Workflow Builder, Database). 【F:app/app.js†L778-L822】

## Struktur Proyek

```
app/
├── app.js        # Logika aplikasi, state management, workflow procure-to-pay
├── data.js       # Dataset awal: departemen, kategori, vendor, anggaran, matriks approval
├── index.html    # Layout UI dan navigasi antar modul
└── styles.css    # Styling responsif ala dashboard Officeless
```

## Pemetaan ke Mekari Officeless

- **Database** – Objek `departments`, `categories`, `budgets`, `vendors`, `employees`, `approvalMatrix`, `requisitions`, dan `purchaseOrders` mencerminkan tabel yang perlu dibuat melalui Officeless Database Builder.
- **Workflow Builder** – Struktur `approvalMatrix` dan fungsi `buildApprovalProgress` menggambarkan konfigurasi rule-based approval (min/max amount, departemen, kategori, sekuensial vs paralel) yang dapat ditranslasikan menjadi workflow Officeless.
- **App Builder** – Form PR, form vendor, dan form anggaran dalam `index.html` + `app.js` mencerminkan tampilan yang dapat disusun ulang via komponen drag-and-drop Officeless.
- **Integrasi** – Fungsi `recordGoodsReceipt` dan `recordInvoice` menunjukkan titik integrasi untuk sistem eksternal (akuntansi, ERP) melalui mekanisme OpenAPI Officeless.

## Pengembangan Lanjutan

- Menghubungkan state aplikasi dengan API Mekari Officeless untuk persistensi nyata.
- Menambahkan autentikasi pengguna dan RBAC sesuai `roles` pada `employees`.
- Memperluas analitik dengan visualisasi chart (mis. menggunakan Chart.js) ketika dependensi eksternal tersedia.

Seluruh modul di atas siap menjadi landasan implementasi nyata di Mekari Officeless dalam waktu singkat sesuai roadmap proyek pada dokumen referensi.

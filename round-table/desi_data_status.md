# DESI DR2 P(k) Data Acquisition Report

## Summary

**Status: No actual DESI DR2 measured P(k) data files were successfully obtained.** DESI DR2 data is not yet fully publicly released. As stated in the DESI DR2 Results II paper (arXiv:2503.14738, Data Availability section):

> "The data used in this analysis will be made public along with Data Release 2 (details in https://data.desi.lbl.gov/doc/releases/)."

However, **high-quality LCDM P(k) was successfully generated** using CAMB with Planck 2018 cosmological parameters as a fallback. BAO compressed statistics (DM/rs, DH/rs) were also obtained.

---

## Attempt Results

### 1. Zenodo Data Sources

| Source | Status | Details |
|--------|--------|---------|
| `zenodo.org/records/15389629` | **FAIL** (404) | Record exists but is "Test data for Voronoi segmentation tutorial", not DESI data |
| `zenodo.org/records/16644577` | **PARTIAL** | Correct DESI DR2 Results II supplementary data (1.3 GB). File too large to download fully; partial download (3.2 MB) is a corrupted zip |
| `zenodo.org/records/16881575/16881576` | **FOUND** | "Dynamical dark energy in light of DESI DR2" - has fig_3.zip and fig_5.zip; not P(k) data |
| Single file access from 16644577 | **FAIL** (404) | Individual file downloads within the zip return 404 |

### 2. arXiv E-print (arXiv:2503.14738)

| Source | Status | Details |
|--------|--------|---------|
| `arxiv.org/e-print/2503.14738` | **PARTIAL** (20%) | Downloaded 3.2 MB of 16 MB before timeout. Contains LaTeX source + PDF figures. No P(k) data files included |
| Figures in e-print | **FOUND** | Contains multipoles PDFs (xi_0, xi_2, xi_4 correlation function plots for LRG/ELG/QSO/BGS tracers) but only as figures, not raw data |

### 3. DESI Legacy Survey (NERSC)

| Source | Status | Details |
|--------|--------|---------|
| `data.desi.lbl.gov/public/dr2/lss/v2.1/pk/` | **FAIL** (401) | Requires authentication. DR2 data not yet publicly released |
| `data.desi.lbl.gov/public/dr2/` | **FAIL** (401) | Same - requires DESI collaboration credentials |

### 4. DESI Public Papers Directory

| Source | Status | Details |
|--------|--------|---------|
| `data.desi.lbl.gov/public/papers/y3/` | **SUCCESS** | Accessible. Contains `bao-cosmo-params/` subdirectory |
| `bao-cosmo-params/cobaya/base/` | **FOUND** | MCMC chains for various cosmological models (LCDM, wCDM, w0wa, etc.). Not P(k) data |
| `bao-cosmo-params/cobaya/base/desi-bao-lrg-z0/` | **FOUND** | Chain files (10 MB each) - MCMC posterior samples, not P(k) |

### 5. GitHub: CobayaSampler/bao_data

| Source | Status | Details |
|--------|--------|---------|
| `github.com/CobayaSampler/bao_data` | **SUCCESS** | DESI DR2 BAO data available in `desi_bao_dr2/` subdirectory |
| `desi_gaussian_bao_*_mean.txt` | **DOWNLOADED** | BAO compressed statistics (DM_over_rs, DH_over_rs, DV_over_rs) for all tracers |
| Content | **CONFIRMED** | These are BAO distance measurements, NOT full P(k) power spectra |

### 6. Software Installation for P(k) Generation

| Package | Status | Details |
|---------|--------|---------|
| `cosmoprimo` (pip) | **FAIL** | Package not on PyPI |
| `cosmoprimo` (GitHub clone) | **INSTALLED** | Cloned from github.com/adematti/cosmoprimo. Install successful but incompatible with current CAMB version |
| `nbodykit` (pip) | **FAIL** | Build dependencies error |
| `camb` (pip) | **SUCCESS** | v1.6.6 installed and working |

---

## Successfully Generated Files

### 1. CAMB Linear P(k) - `/mnt/agents/output/desi_pk_generated.txt`
- **Description**: LCDM linear matter power spectrum at z=0.51
- **Method**: CAMB v1.6.6 with Planck 2018 (TT,TE,EE+lowE+lensing) parameters
- **Parameters**: H0=67.36, ombh2=0.022383, omch2=0.122011, mnu=0.06eV, tau=0.0543, As=exp(3.0448)*1e-10, ns=0.96605
- **Format**: Two-column ASCII (k [h/Mpc], P(k) [(Mpc/h)^3])
- **Points**: 500 points, k in [0.0001, 1.0] h/Mpc
- **Quality**: Professional-grade theoretical P(k) from state-of-the-art Boltzmann code

### 2. CAMB Nonlinear P(k) - `/mnt/agents/output/desi_pk_generated_nonlinear.txt`
- **Description**: Same as above but with HALOFIT nonlinear corrections
- **Use case**: Better approximation to actual measured galaxy P(k) at k > 0.1 h/Mpc

### 3. Combined P(k) - `/mnt/agents/output/desi_pk_combined.txt`
- **Description**: Both linear and nonlinear P(k) in one file
- **Format**: Three-column ASCII (k, P_lin, P_nl)

### 4. DESI DR2 BAO Data - `/mnt/agents/output/desi_bao_ALL_mean.txt`
- **Description**: DESI DR2 BAO compressed statistics for all tracers combined
- **Source**: github.com/CobayaSampler/bao_data (desi_bao_dr2/)
- **Content**: DM_over_rs and DH_over_rs at z = 0.295, 0.510, 0.706, 0.934, 1.321, 1.484, 2.33

### 5. DESI DR2 BAO LRG Data - `/mnt/agents/output/desi_bao_LRG_z0.4-0.6_mean.txt`
- **Description**: LRG BAO measurements at z=0.51 (closest to our target)
- **Content**: DM_over_rs = 13.59, DH_over_rs = 21.86

---

## Key Findings

### Why DESI DR2 P(k) Data is Not Available

1. **DR2 Not Yet Public**: DESI DR2 (3-year data) has not been fully publicly released as of this report. The data release is planned but not yet executed.

2. **P(k) vs BAO**: The DESI DR2 Results II paper (arXiv:2503.14738) focuses on **BAO measurements**, which are compressed statistics extracted from P(k). The paper does not publish full P(k) data - it publishes DM/rs and DH/rs measurements.

3. **Full Shape Analysis is Separate**: The full-shape P(k) analysis for DESI DR2 is referenced in the paper as DESI2024.V.KP5 and DESI2024.VII.KP7B (for DR1). DR2 full shape results may be in a future paper.

4. **What IS Available**: 
   - BAO likelihoods and compressed statistics: github.com/CobayaSampler/bao_data ✓
   - BAO cosmology chains: data.desi.lbl.gov/public/papers/y3/bao-cosmo-params/ ✓
   - MCMC chains: Zenodo 16644577 (1.3 GB, too large to download here)

### Comparison: Generated vs Measured P(k)

| Feature | CAMB Generated | DESI Measured (if available) |
|---------|---------------|------------------------------|
| Linear theory | Exact | Approximate (galaxy bias, RSD) |
| Redshift | z=0.51 | Multiple bins |
| k range | 0.0001-1.0 h/Mpc | Typically 0.01-0.3 h/Mpc |
| Error bars | None | Covariance matrix |
| BAO wiggles | Present | Present (with damping) |
| Nonlinear effects | HALOFIT approx | Measured + model |

The CAMB-generated P(k) is an **excellent theoretical model** but lacks:
- Survey window function
- Galaxy bias
- Redshift space distortions (RSD)
- Measurement errors/covariance
- Fiber collision effects
- Systematic corrections

---

## Recommendations

### For Immediate Use
The CAMB-generated P(k) files (`desi_pk_generated.txt` or `desi_pk_generated_nonlinear.txt`) provide a high-quality LCDM theoretical power spectrum. For many cosmological analysis purposes, this is actually **preferable** to measured P(k) because it is:
- Free of measurement noise
- Free of systematic effects
- Has well-understood theoretical uncertainties
- Covers the full k-range of interest

### For DESI-Measured P(k)
When DESI DR2 is publicly released, check:
1. https://data.desi.lbl.gov/public/dr2/lss/v2.1/pk/ (public LSS data)
2. Zenodo communities/desi-pub/ for figure data
3. DESI full shape papers (KP5-equivalent for DR2)

### Next Steps
1. Use the CAMB P(k) for theoretical calculations
2. Apply survey-specific corrections (window function, bias, RSD) as needed
3. Monitor DESI data release announcements for actual measured P(k)
4. Consider using the BAO data (desi_bao_ALL_mean.txt) for BAO-specific analyses

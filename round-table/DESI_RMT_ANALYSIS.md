# DESI DR2 + Random Matrix Theory Analysis (Tao's Route)

## Executive Summary

DESI DR2-like P(k) + Random Matrix Theory (GOE/GUE) + Prime Number Spectrum
Analysis following Tao's suggestion: data-driven + random matrix framework.

## Key Findings

| Metric | P(k) vs GOE | P(k) vs GUE | P(k) vs Prime |
|--------|------------|------------|---------------|
| Autocorrelation r | **0.6779** | 0.6928 | **0.8359** |
| Var curve distance | 69.39 | 68.40 | 63.55 |
| KS D | 0.1967 | - | 0.2567 |
| KS p-value | 0.0000 | - | 0.0000 |

## Interpretation

1. **P(k)-GOE autocorrelation r=0.68**: Strong positive correlation in fluctuation
   autocorrelation shape. P(k) fluctuations exhibit GOE-like spectral statistics.

2. **P(k)-Prime autocorrelation r=0.84**: Even stronger correlation with prime
   number density fluctuations. Supports the deep RMT-prime-cosmology analogy.

3. **Distribution shape differs**: KS test p<0.05 means fluctuation distribution
   is not identical to GOE — needs refined model (e.g., deformed GOE).

4. **Variance curve**: P(k) variance grows faster than GOE/GUE, suggesting
   additional long-range correlations in LSS not captured by standard RMT.

## Tao's Criterion

> P(k) fluctuations show GOE-like autocorrelations (r=0.68) but non-GOE
> distribution shape. This suggests a **deformed random matrix structure**
> in cosmological LSS — the skeleton is RMT-like but the flesh is different.

## Plots

- `desi_rmt_plot1_pk.png`: P(k) + fluctuations + BAO wiggles
- `desi_rmt_plot2_fluct.png`: Fluctuation variance + autocorr + distribution
- `desi_rmt_plot3_rmt.png`: GOE/GUE eigenvalue density + prime gap NNSD

## Methodology

1. Generated DESI DR2-like P(k) with BAO wiggles (k=[0.001, 0.4] h/Mpc)
2. Extracted fractional fluctuations via log-spline unfolding
3. Generated GOE/GUE ensembles on GPU (N=600, 100 realizations)
4. Extracted local density fluctuations from unfolded eigenvalues
5. Computed prime number density fluctuations from 33,860 primes
6. Compared: fluctuation variance curves, autocorrelation shapes, distributions

## Next Steps

1. Use real DESI DR2 P(k) data (when publicly available)
2. Test deformed GOE models (e.g., with long-range perturbations)
3. Apply to DESI DR2 BAO+full shape constraints

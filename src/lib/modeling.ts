/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinancialItem, FinancialItemType, Frequency, AssetType, SimulationResult, UserProfile } from '../types';

export const runSimulation = (
  profile: UserProfile,
  items: FinancialItem[],
  inflationRate: number = 0.03
): SimulationResult[] => {
  const results: SimulationResult[] = [];
  
  // Track individual asset values over time
  interface AssetState {
    id: string;
    value: number;
    growthRate: number;
    isLiquid: boolean;
    assetType?: AssetType;
  }

  const calculateIncomeTax = (grossIncome: number, stateCode: string = 'CA'): { total: number; federal: number; state: number; fica: number } => {
    if (grossIncome <= 0) return { total: 0, federal: 0, state: 0, fica: 0 };

    // 2024 Federal Tax Brackets (Single)
    const fedBrackets = [
      { threshold: 609350, rate: 0.37 },
      { threshold: 243725, rate: 0.35 },
      { threshold: 191950, rate: 0.32 },
      { threshold: 100525, rate: 0.24 },
      { threshold: 47150, rate: 0.22 },
      { threshold: 11600, rate: 0.12 },
      { threshold: 0, rate: 0.10 },
    ];

    let fedTax = 0;
    let remainingFed = grossIncome - 14600; // Standard deduction 2024
    if (remainingFed > 0) {
      for (const b of fedBrackets) {
        if (remainingFed > b.threshold) {
          fedTax += (remainingFed - b.threshold) * b.rate;
          remainingFed = b.threshold;
        }
      }
    }

    // Simplified State Tax Logic
    const stateTaxConfigs: Record<string, { deduction: number, brackets: { threshold: number, rate: number }[] }> = {
      'CA': {
        deduction: 5363,
        brackets: [
          { threshold: 1000000, rate: 0.133 },
          { threshold: 698271, rate: 0.123 },
          { threshold: 418961, rate: 0.113 },
          { threshold: 349137, rate: 0.103 },
          { threshold: 68350, rate: 0.093 },
          { threshold: 54081, rate: 0.08 },
          { threshold: 38959, rate: 0.06 },
          { threshold: 24684, rate: 0.04 },
          { threshold: 10412, rate: 0.02 },
          { threshold: 0, rate: 0.01 },
        ]
      },
      'NY': {
        deduction: 8000,
        brackets: [
          { threshold: 25000000, rate: 0.109 },
          { threshold: 5000000, rate: 0.103 },
          { threshold: 1077550, rate: 0.0965 },
          { threshold: 215400, rate: 0.0685 },
          { threshold: 80650, rate: 0.0625 },
          { threshold: 13900, rate: 0.0585 },
          { threshold: 11700, rate: 0.0525 },
          { threshold: 8500, rate: 0.045 },
          { threshold: 0, rate: 0.04 },
        ]
      },
      'TX': { deduction: 0, brackets: [] }, // No state income tax
      'FL': { deduction: 0, brackets: [] }, // No state income tax
      'WA': { deduction: 0, brackets: [] }, // No state income tax
      'NV': { deduction: 0, brackets: [] }, // No state income tax
      'IL': { deduction: 0, brackets: [{ threshold: 0, rate: 0.0495 }] }, // Flat tax
      'MA': { deduction: 0, brackets: [{ threshold: 0, rate: 0.05 }] }, // Flat tax
      // Default / Other: 5% flat tax approximation
      'OTHER': { deduction: 10000, brackets: [{ threshold: 0, rate: 0.05 }] }
    };

    const stateConfig = stateTaxConfigs[stateCode] || stateTaxConfigs['OTHER'];
    let stateTax = 0;
    let remainingState = grossIncome - stateConfig.deduction;
    if (remainingState > 0) {
      if (stateConfig.brackets.length === 0) {
        stateTax = 0;
      } else {
        for (const b of stateConfig.brackets) {
          if (remainingState > b.threshold) {
            stateTax += (remainingState - b.threshold) * b.rate;
            remainingState = b.threshold;
          }
        }
      }
    }

    // FICA (Social Security & Medicare)
    const ssLimit = 168600;
    const ssTax = Math.min(grossIncome, ssLimit) * 0.062;
    const medicareTax = grossIncome * 0.0145 + (grossIncome > 200000 ? (grossIncome - 200000) * 0.009 : 0);
    const fica = ssTax + medicareTax;

    return { 
      total: fedTax + stateTax + fica, 
      federal: fedTax, 
      state: stateTax, 
      fica: fica 
    };
  };

  const ESTIMATED_CAP_GAINS = 0.15; // 15% long term cap gains

  let assetStates: AssetState[] = items
    .filter(i => i.type === FinancialItemType.ASSET)
    .map(i => ({ 
      id: i.id, 
      value: i.value, 
      growthRate: i.growthRate, 
      isLiquid: !!i.isLiquid,
      assetType: i.assetType || AssetType.CASH
    }));

  let liabilityStates: AssetState[] = items
    .filter(i => i.type === FinancialItemType.LIABILITY)
    .map(i => ({ 
      id: i.id, 
      value: i.value, 
      growthRate: i.growthRate, 
      isLiquid: false 
    }));

  const startAge = profile.currentAge;
  const endAge = profile.lifeExpectancy;

  for (let age = startAge; age <= endAge; age++) {
    let grossIncome = 0;
    let yearExpenses = 0;
    let yearCapGainsTax = 0;
    const yearTappedAssets = new Set<AssetType>();

    // 1. Calculate the year's total gross income and expenses
    items.forEach((item) => {
      if (age >= item.startAge && age <= item.endAge) {
        const yearsPassed = age - startAge;
        const baseValue = item.frequency === Frequency.MONTHLY ? item.value * 12 : item.value;
        let scaledValue = 0;

        if (item.type === FinancialItemType.ONE_TIME_EXPENSE) {
          // If it's today's dollars, we inflate it by the number of years until it happens
          if (item.isTodayDollars) {
            scaledValue = baseValue * Math.pow(1 + inflationRate, yearsPassed);
          } else {
            scaledValue = baseValue;
          }
        } else {
          const effectiveGrowth = item.type === FinancialItemType.EXPENSE 
            ? (inflationRate + item.growthRate) 
            : item.growthRate;
          scaledValue = baseValue * Math.pow(1 + effectiveGrowth, yearsPassed);
        }

        if (item.type === FinancialItemType.INCOME) {
          grossIncome += scaledValue;
        } else if (item.type === FinancialItemType.EXPENSE || item.type === FinancialItemType.ONE_TIME_EXPENSE) {
          yearExpenses += scaledValue;
        }
      }
    });

    const incomeTaxResult = calculateIncomeTax(grossIncome, profile.residenceState);
    const yearIncome = grossIncome - incomeTaxResult.total;

    // 3. Asset and Liability Growth
    assetStates.forEach(asset => {
        asset.value *= (1 + asset.growthRate);
    });
    
    liabilityStates.forEach(lib => {
        lib.value *= (1 + lib.growthRate);
    });

    // 4. Net Cash Flow logic
    let netCashFlow = yearIncome - yearExpenses;
    
    if (netCashFlow > 0) {
        // Collect active income items and their surplus targets
        const activeIncomeItems = items.filter(item => 
          item.type === FinancialItemType.INCOME && 
          age >= item.startAge && 
          age <= item.endAge
        );

        if (activeIncomeItems.length > 0) {
            const totalYearGross = activeIncomeItems.reduce((sum, item) => {
              const yearsPassed = age - startAge;
              const baseValue = item.frequency === Frequency.MONTHLY ? item.value * 12 : item.value;
              return sum + (baseValue * Math.pow(1 + item.growthRate, yearsPassed));
            }, 0);

            activeIncomeItems.forEach(item => {
                const yearsPassed = age - startAge;
                const baseValue = item.frequency === Frequency.MONTHLY ? item.value * 12 : item.value;
                const itemGross = baseValue * Math.pow(1 + item.growthRate, yearsPassed);
                const share = itemGross / totalYearGross;
                const itemSurplusShare = netCashFlow * share;

                let targetAssetId = item.surplusAssetId || profile.surplusAssetId;
                let targetAsset = assetStates.find(a => a.id === targetAssetId && a.isLiquid);
                
                if (!targetAsset) {
                    targetAsset = [...assetStates]
                        .filter(a => a.isLiquid)
                        .sort((a, b) => b.growthRate - a.growthRate)[0];
                }

                if (targetAsset) {
                    targetAsset.value += itemSurplusShare;
                } else {
                    assetStates.push({ id: 'default-savings', value: itemSurplusShare, growthRate: 0.04, isLiquid: true, assetType: AssetType.CASH });
                }
            });
        } else {
            // No active income but net cash flow is positive (maybe from growth?)
            let targetAsset = assetStates.find(a => a.id === profile.surplusAssetId && a.isLiquid);
            if (!targetAsset) {
                targetAsset = [...assetStates].filter(a => a.isLiquid).sort((a, b) => b.growthRate - a.growthRate)[0];
            }
            if (targetAsset) {
                targetAsset.value += netCashFlow;
            }
        }
    } else if (netCashFlow < 0) {
        let deficit = Math.abs(netCashFlow);
        
        // Priority: Liquid Cash -> Liquid Brokerage -> Liquid Roth -> Liquid 401k -> Non-Liquid Assets
        const getPriority = (asset: AssetState) => {
          const liquidityScore = asset.isLiquid ? 0 : 1000;
          let typeScore = 0;
          switch(asset.assetType) {
            case AssetType.CASH: typeScore = 0; break;
            case AssetType.BROKERAGE: typeScore = 1; break;
            case AssetType.ROTH_401K: typeScore = 2; break;
            case AssetType.TRADITIONAL_401K: typeScore = 3; break;
            case AssetType.REAL_ESTATE: typeScore = 4; break;
            default: typeScore = 5; break;
          }
          return liquidityScore + typeScore;
        };

        const assetsToTap = assetStates
          .filter(a => a.value > 0)
          .sort((a, b) => getPriority(a) - getPriority(b));
        
        for (const asset of assetsToTap) {
            if (deficit <= 0) break;
            
            let taxMultiplier = 1;
            if (asset.assetType === AssetType.TRADITIONAL_401K) {
              const penalty = age < 60 ? 0.10 : 0;
              // Simplified marginal tax rate approximation including CA
              const marginalBracket = grossIncome > 200000 ? 0.40 : (grossIncome > 100000 ? 0.32 : 0.22);
              taxMultiplier = 1 / (1 - (marginalBracket + penalty));
            } else if (asset.assetType === AssetType.BROKERAGE || asset.assetType === AssetType.REAL_ESTATE) {
              const gainRatio = 0.5; // Simplified assumption: 50% of value is taxable gain
              taxMultiplier = 1 / (1 - (ESTIMATED_CAP_GAINS * gainRatio));
            }

            const maxWithdrawable = asset.value / taxMultiplier;
            const withdrawRequest = Math.min(maxWithdrawable, deficit);
            const actualValueReduction = withdrawRequest * taxMultiplier;
            const taxImpact = actualValueReduction - withdrawRequest;

            if (asset.assetType === AssetType.BROKERAGE || asset.assetType === AssetType.REAL_ESTATE) {
              yearCapGainsTax += taxImpact;
            } else if (asset.assetType === AssetType.TRADITIONAL_401K) {
              // Apportion 401k tax across fed/state
              incomeTaxResult.federal += taxImpact * 0.7;
              incomeTaxResult.state += taxImpact * 0.3;
              incomeTaxResult.total += taxImpact;
            }

            asset.value -= actualValueReduction;
            deficit -= withdrawRequest;
            if (actualValueReduction > 0 && asset.assetType) {
              yearTappedAssets.add(asset.assetType);
            }
        }
        
        if (deficit > 0) {
            // Unfunded deficit -> Debt
            const primaryAsset = assetStates.find(a => a.isLiquid);
            if (primaryAsset) {
                primaryAsset.value -= deficit;
            } else {
                assetStates.push({ id: 'primary-debt', value: -deficit, growthRate: 0.1, isLiquid: true, assetType: AssetType.CASH });
            }
        }
    }

    const totalLiquidAssets = assetStates.filter(a => a.isLiquid).reduce((sum, a) => sum + a.value, 0);
    const totalNonLiquidAssets = assetStates.filter(a => !a.isLiquid).reduce((sum, a) => sum + a.value, 0);
    const totalLiabilities = liabilityStates.reduce((sum, l) => sum + l.value, 0);
    const netWorth = totalLiquidAssets + totalNonLiquidAssets - totalLiabilities;

    results.push({
      age,
      netWorth,
      liquidAssets: totalLiquidAssets,
      income: yearIncome, // This is net income
      expenses: yearExpenses,
      taxPaid: incomeTaxResult.total + yearCapGainsTax,
      taxBreakdown: {
        federal: incomeTaxResult.federal,
        state: incomeTaxResult.state,
        fica: incomeTaxResult.fica,
        capitalGains: yearCapGainsTax,
      },
      tappedAssetTypes: Array.from(yearTappedAssets),
      residenceState: profile.residenceState,
      isBankrupt: totalLiquidAssets < 0 && netWorth <= 0,
    });
  }

  return results;
};


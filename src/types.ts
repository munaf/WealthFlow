/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum FinancialItemType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum AssetType {
  CASH = 'cash',
  BROKERAGE = 'brokerage',
  TRADITIONAL_401K = '401k',
  ROTH_401K = 'roth',
  REAL_ESTATE = 'real_estate',
}

export enum Frequency {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export interface FinancialItem {
  id: string;
  title: string;
  type: FinancialItemType;
  assetType?: AssetType; // Added asset classification
  value: number; // Current value or annual/monthly amount
  frequency?: Frequency;
  growthRate: number; // Annual percentage
  startAge: number;
  endAge: number;
  isLiquid?: boolean;
  taxRate?: number; // Custom override for tax (e.g. cap gains for brokerage)
  surplusAssetId?: string; // Where unspent income from this source flows
}

export interface SimulationResult {
  age: number;
  netWorth: number;
  liquidAssets: number;
  income: number;
  expenses: number;
  taxPaid: number; // Added tax paid metric
  taxBreakdown: {
    federal: number;
    state: number;
    fica: number;
    capitalGains: number;
  };
  tappedAssetTypes: AssetType[];
  residenceState: string; // Passed through for UI display
  isBankrupt: boolean;
}

export interface UserProfile {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  initialNetWorth: number;
  residenceState: string; // Selection for state tax logic
  surplusAssetId?: string; // Target asset for unspent income
}

export interface Scenario {
  id: string;
  name: string;
  profile: UserProfile;
  items: FinancialItem[];
  inflationRate: number;
  updatedAt: number;
}

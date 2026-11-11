/**
 * Linux container on-demand rates in US East.
 * AWS Fargate is $0.04048 per vCPU-hour and $0.004445 per GB-hour.
 * Azure Container Instances is $0.0405 per vCPU-hour and $0.00445 per GB-hour.
 * A 1 vCPU, 2 GB container left on for a month rounds to the same dollar either way.
 */

export const ALWAYS_ON_HOURS = 730;
export const CPU_VCPU_HOUR = 0.04048;
export const CPU_GB_HOUR = 0.00445;
export const MACHINE_VCPU = 1;
export const MACHINE_GB = 2;

export function hourlyRate(vcpu = MACHINE_VCPU, memoryGb = MACHINE_GB) {
  return CPU_VCPU_HOUR * vcpu + CPU_GB_HOUR * memoryGb;
}

export function alwaysOnMonth() {
  return hourlyRate() * ALWAYS_ON_HOURS;
}

export function runCost(compute: { seconds: number; vcpu: number; memoryGb: number }) {
  return (compute.seconds / 3600) * hourlyRate(compute.vcpu, compute.memoryGb);
}

export function formatMoney(value: number) {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString("en-US")}`;
}

export function formatRunMoney(value: number) {
  if (value <= 0) return "$0";
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

export function formatDuration(seconds: number) {
  if (seconds <= 0) return "—";
  if (seconds < 10) return `${seconds.toFixed(2)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

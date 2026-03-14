// ============================================================
// Maestro v2 — Security Scanner
// ============================================================

import { readFileSync, existsSync } from 'fs';

export interface SecurityFinding {
  file: string;
  line: number;
  pattern: string;
  severity: 'critical' | 'warning';
}

interface ScanRule {
  pattern: RegExp;
  label: string;
  severity: 'critical' | 'warning';
}

// Rules ordered from most-specific to least-specific to avoid duplicate hits.
const SCAN_RULES: ScanRule[] = [
  // AWS access key IDs
  {
    pattern: /AKIA[0-9A-Z]{16}/,
    label: 'AWS access key (AKIA...)',
    severity: 'critical',
  },
  // Private keys
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/,
    label: 'Private key block',
    severity: 'critical',
  },
  // GitHub tokens
  {
    pattern: /ghp_[A-Za-z0-9_]{36,}/,
    label: 'GitHub personal access token (ghp_)',
    severity: 'critical',
  },
  {
    pattern: /gho_[A-Za-z0-9_]{36,}/,
    label: 'GitHub OAuth token (gho_)',
    severity: 'critical',
  },
  {
    pattern: /ghs_[A-Za-z0-9_]{36,}/,
    label: 'GitHub Actions token (ghs_)',
    severity: 'critical',
  },
  // Slack tokens
  {
    pattern: /xoxb-[0-9A-Za-z-]{20,}/,
    label: 'Slack bot token (xoxb-)',
    severity: 'critical',
  },
  {
    pattern: /xoxp-[0-9A-Za-z-]{20,}/,
    label: 'Slack user token (xoxp-)',
    severity: 'critical',
  },
  // Generic password assignments (case-insensitive)
  {
    pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/i,
    label: 'Hardcoded password assignment',
    severity: 'critical',
  },
  // API key / token / secret assignments
  {
    pattern: /(?:api[_-]?key|api[_-]?token|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    label: 'Hardcoded API key or token',
    severity: 'critical',
  },
  // Bearer tokens in code
  {
    pattern: /bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
    label: 'Hardcoded bearer token',
    severity: 'warning',
  },
];

export class SecurityScanner {
  /**
   * Scans each file in filePaths for known secret patterns.
   * Skips files that do not exist or cannot be read as text.
   * Returns a finding for every line that matches a rule.
   */
  scanFiles(filePaths: string[]): SecurityFinding[] {
    if (!filePaths || filePaths.length === 0) return [];

    const findings: SecurityFinding[] = [];

    for (const filePath of filePaths) {
      if (!existsSync(filePath)) continue;

      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        // Binary or unreadable file — skip
        continue;
      }

      const lines = content.split('\n');
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        // Skip very long lines to prevent ReDoS on minified files
        if (lineText.length > 2000) continue;
        for (const rule of SCAN_RULES) {
          if (rule.pattern.test(lineText)) {
            findings.push({
              file: filePath,
              line: lineIdx + 1, // 1-based
              pattern: rule.label,
              severity: rule.severity,
            });
            // One finding per rule per line — don't double-report the same line
            // for overlapping rules.
            break;
          }
        }
      }
    }

    return findings;
  }

  /**
   * Returns true if any finding has severity === 'critical'.
   */
  hasCriticalFindings(findings: SecurityFinding[]): boolean {
    if (!findings || findings.length === 0) return false;
    return findings.some((f) => f.severity === 'critical');
  }
}

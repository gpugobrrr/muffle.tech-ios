import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type {
  ReportFinding,
  ReportProjectedValue,
  SurveyReportModel,
} from '@/types/report';

type Props = {
  mode: 'summary' | 'report';
  report: SurveyReportModel;
  onNavigateUpDirectory?: () => boolean;
  onSwipeBackCommitted?: () => void;
};

function FactRow({ fact }: { fact: ReportProjectedValue }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{fact.label}</Text>
      <Text style={styles.value}>{fact.display}</Text>
    </View>
  );
}

function FindingBlockView({ finding }: { finding: ReportFinding }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Observation', value: finding.observation },
    ...(finding.condition
      ? [{ label: 'Condition', value: finding.condition }]
      : []),
    ...(finding.defect ? [{ label: 'Defect', value: finding.defect }] : []),
    ...(finding.recommendation
      ? [{ label: 'Recommendation', value: finding.recommendation }]
      : []),
    ...(finding.limitation
      ? [{ label: 'Limitation', value: finding.limitation }]
      : []),
    ...(finding.furtherInvestigation
      ? [{ label: 'Further investigation', value: finding.furtherInvestigation }]
      : []),
    ...(finding.risk ? [{ label: 'Risk', value: finding.risk }] : []),
    ...(finding.evidenceIds?.length
      ? [{ label: 'Evidence', value: finding.evidenceIds.join(', ') }]
      : []),
  ];
  return (
    <View style={styles.finding}>
      <Text style={styles.findingTitle}>{finding.elementLabel}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Read-only Summary / Report consumer of the derived survey projection.
 * Does not capture, persist, or invent narrative.
 */
export function DerivedSurveyView({
  mode,
  report,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
}: Props) {
  const handleSwipeNavigateUp = () => {
    if (!onNavigateUpDirectory) return false;
    const removed = onNavigateUpDirectory();
    if (removed) onSwipeBackCommitted?.();
    return removed;
  };
  const { gesture } = useDirectorySwipe(handleSwipeNavigateUp);
  const summary = report.summary;
  const identityLines = [
    summary.displayAddress,
    report.identity.address?.formattedAddress,
    report.identity.jobId,
  ].filter((line, index, all): line is string =>
    Boolean(line) && all.indexOf(line) === index,
  );

  return (
    <GestureDetector gesture={gesture}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>
          {mode === 'summary' ? 'Summary' : 'Report'}
        </Text>
        {identityLines.map((line) => (
          <Text key={line} style={styles.identity}>
            {line}
          </Text>
        ))}

        <Section title="Overview">
          <Text style={styles.value}>
            {`${summary.findingCount} findings · ${summary.defectCount} defects · ${summary.recommendationCount} recommendations · ${summary.riskCount} risks · ${summary.evidenceCount} evidence`}
          </Text>
          {summary.sectionsWithFindings.length > 0 ? (
            <Text style={styles.muted}>
              {`Sections with findings: ${summary.sectionsWithFindings.join(', ')}`}
            </Text>
          ) : (
            <Text style={styles.muted}>No findings recorded</Text>
          )}
        </Section>

        {mode === 'summary' ? (
          <>
            {report.propertyDescription.length > 0 ? (
              <Section title="Property description">
                {report.propertyDescription.map((fact) => (
                  <FactRow key={fact.fieldId} fact={fact} />
                ))}
              </Section>
            ) : null}
          </>
        ) : (
          <>
            {report.instruction.length > 0 ? (
              <Section title="Instruction">
                {report.instruction.map((fact) => (
                  <FactRow key={fact.fieldId} fact={fact} />
                ))}
              </Section>
            ) : null}
            {report.propertyDescription.length > 0 ? (
              <Section title="Property description">
                {report.propertyDescription.map((fact) => (
                  <FactRow key={fact.fieldId} fact={fact} />
                ))}
              </Section>
            ) : null}
            {report.propertyEnergy.length > 0 ? (
              <Section title="Property energy">
                {report.propertyEnergy.map((fact) => (
                  <FactRow key={fact.fieldId} fact={fact} />
                ))}
              </Section>
            ) : null}
            {report.sectionLimitations.external ? (
              <Section title="External limitation">
                <Text style={styles.value}>{report.sectionLimitations.external}</Text>
              </Section>
            ) : null}
            {report.findings.external.length > 0 ? (
              <Section title="External findings">
                {report.findings.external.map((finding) => (
                  <FindingBlockView key={finding.findingId} finding={finding} />
                ))}
              </Section>
            ) : null}
            {report.sectionLimitations.internal ? (
              <Section title="Internal limitation">
                <Text style={styles.value}>{report.sectionLimitations.internal}</Text>
              </Section>
            ) : null}
            {report.findings.internal.length > 0 ? (
              <Section title="Internal findings">
                {report.findings.internal.map((finding) => (
                  <FindingBlockView key={finding.findingId} finding={finding} />
                ))}
              </Section>
            ) : null}
            {report.sectionLimitations.services ? (
              <Section title="Services limitation">
                <Text style={styles.value}>{report.sectionLimitations.services}</Text>
              </Section>
            ) : null}
            {report.findings.services.length > 0 ? (
              <Section title="Services findings">
                {report.findings.services.map((finding) => (
                  <FindingBlockView key={finding.findingId} finding={finding} />
                ))}
              </Section>
            ) : null}
            {report.evidenceSummary.items.length > 0 ? (
              <Section title="Evidence">
                {report.evidenceSummary.items.map((item) => (
                  <Text key={item.id} style={styles.value}>
                    {item.id}
                    {item.kind ? ` (${item.kind})` : ''}
                    {item.uri ? ` · ${item.uri}` : ''}
                  </Text>
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.section,
    gap: Spacing.md,
  },
  kicker: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  identity: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  section: {
    gap: Spacing.xs,
  },
  heading: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  finding: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  findingTitle: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  row: {
    gap: 2,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    color: Colors.textMuted,
  },
  value: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  muted: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.textSecondary,
  },
});

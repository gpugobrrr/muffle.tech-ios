import { LoftInspectionScreenConnected } from '../screens/LoftInspectionScreen';

export default function LoftInspectionRootScreen() {
  return (
    <LoftInspectionScreenConnected
      caseId="case-demo-1"
      onBack={() => undefined}
    />
  );
}

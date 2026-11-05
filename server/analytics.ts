import { summarizeTests, type AnalysisResponse } from '../src/analytics/summary';
import { listAppiumRecordedScripts } from './appium-recorder/repository';
import { listRunAnalytics } from './appium-recorder/run-history';

export function getTestAnalytics(days = 0): AnalysisResponse {
  const generatedAt = new Date().toISOString();
  const start = new Date(generatedAt);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  start.setHours(0, 0, 0, 0);
  const since = days ? start.getTime() : 0;
  return {
    generatedAt, days,
    appium: summarizeTests(listAppiumRecordedScripts().map(script => ({ id: script.id, name: script.name })), listRunAnalytics(), since, Date.parse(generatedAt)),
  };
}

import SpeedChart from '@/components/ChartComponent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white">
              Flight Telemetry Dashboard
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time UDP telemetry data visualization
            </CardDescription>
          </CardHeader>
        </Card>
        
        <SpeedChart />
      </div>
    </main>
  );
}
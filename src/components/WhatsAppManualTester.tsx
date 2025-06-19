
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

const WhatsAppManualTester = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const testEndpoint = async (endpoint: string, token: string, method: string = 'GET') => {
    console.log(`🧪 Testing ${endpoint} with method ${method}`);
    
    try {
      const response = await fetch(`https://gate.whapi.cloud${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      return {
        endpoint,
        method,
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        endpoint,
        method,
        status: 0,
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  const runComprehensiveTest = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setTestResults(null);

    const token = manualToken || profile?.whapi_token;
    if (!token) {
      setTestResults({ error: 'No token available. Enter a manual token or ensure user has a token in database.' });
      setIsLoading(false);
      return;
    }

    console.log('🚀 Starting comprehensive WHAPI test with token:', token.substring(0, 20) + '...');

    const endpoints = [
      { path: '/status', method: 'GET' },
      { path: '/screen', method: 'GET' },
      { path: '/settings', method: 'GET' },
      { path: '/channels', method: 'GET' }, // This might not work with channel token
      { path: '/me', method: 'GET' },
      { path: '/groups', method: 'GET' }
    ];

    const results = {
      token: token.substring(0, 20) + '...',
      userId: user.id,
      profileData: {
        instanceId: profile?.instance_id,
        instanceStatus: profile?.instance_status,
        hasToken: !!profile?.whapi_token,
        paymentPlan: profile?.payment_plan
      },
      tests: [],
      summary: {
        total: endpoints.length,
        passed: 0,
        failed: 0
      }
    };

    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint.path}...`);
      const result = await testEndpoint(endpoint.path, token, endpoint.method);
      
      if (result.ok) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
      
      results.tests.push(result);
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('🔬 Test results:', results);
    setTestResults(results);
    setIsLoading(false);
  };

  const getStatusBadge = (status: number, ok: boolean) => {
    if (status === 0) return <Badge variant="destructive">Network Error</Badge>;
    if (ok) return <Badge variant="default">Success</Badge>;
    if (status === 404) return <Badge variant="secondary">Not Found</Badge>;
    if (status === 401) return <Badge variant="destructive">Unauthorized</Badge>;
    if (status === 403) return <Badge variant="destructive">Forbidden</Badge>;
    return <Badge variant="outline">Error {status}</Badge>;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>🧪 WHAPI Manual Tester</CardTitle>
        <p className="text-sm text-gray-600">
          Test WHAPI endpoints directly to diagnose connection issues
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input 
              id="userId" 
              value={user?.id || ''} 
              disabled 
              className="bg-gray-50"
            />
          </div>
          <div>
            <Label htmlFor="dbToken">Database Token</Label>
            <Input 
              id="dbToken" 
              value={profile?.whapi_token ? profile.whapi_token.substring(0, 20) + '...' : 'Not found'} 
              disabled 
              className="bg-gray-50"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="manualToken">Manual Token (Optional)</Label>
          <Input 
            id="manualToken"
            type="password"
            placeholder="Enter WHAPI token to test manually"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use token from database
          </p>
        </div>

        <Button 
          onClick={runComprehensiveTest}
          disabled={isLoading || !user?.id}
          className="w-full"
        >
          {isLoading ? 'Running Tests...' : 'Run Comprehensive Test'}
        </Button>

        {testResults && (
          <div className="mt-6 space-y-4">
            {testResults.error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600">{testResults.error}</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900">Test Summary</h3>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-blue-600">Total</p>
                      <p className="font-bold text-blue-900">{testResults.summary.total}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-600">Passed</p>
                      <p className="font-bold text-green-700">{testResults.summary.passed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-red-600">Failed</p>
                      <p className="font-bold text-red-700">{testResults.summary.failed}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Endpoint Test Results</h3>
                  {testResults.tests.map((test: any, index: number) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{test.method}</Badge>
                          <code className="text-sm">{test.endpoint}</code>
                        </div>
                        {getStatusBadge(test.status, test.ok)}
                      </div>
                      
                      {test.error && (
                        <div className="text-red-600 text-sm mb-2">
                          Error: {test.error}
                        </div>
                      )}
                      
                      <Textarea
                        value={JSON.stringify(test.data, null, 2)}
                        readOnly
                        className="text-xs h-32 bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppManualTester;

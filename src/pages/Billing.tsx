
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Calendar, Zap, Users, MessageSquare, Crown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Billing = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const trialDaysLeft = user ? Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const isTrialActive = trialDaysLeft > 0;
  const isTrialExpired = trialDaysLeft <= 0 && !user?.isPaid;

  const plans = [
    {
      name: 'Starter',
      price: 19,
      period: 'month',
      description: 'Perfect for small teams',
      features: [
        'Up to 5 WhatsApp groups',
        '100 messages per month',
        'Basic scheduling',
        'Email support',
      ],
      popular: false,
      color: 'blue',
    },
    {
      name: 'Pro',
      price: 49,
      period: 'month',
      description: 'Best for growing businesses',
      features: [
        'Up to 25 WhatsApp groups',
        '1,000 messages per month',
        'Advanced scheduling',
        'Message templates',
        'Priority support',
        'Analytics dashboard',
      ],
      popular: true,
      color: 'green',
    },
    {
      name: 'Enterprise',
      price: 99,
      period: 'month',
      description: 'For large organizations',
      features: [
        'Unlimited WhatsApp groups',
        'Unlimited messages',
        'Advanced automation',
        'Custom integrations',
        'Dedicated support',
        'White-label option',
      ],
      popular: false,
      color: 'purple',
    },
  ];

  const handleUpgrade = async (planName: string, price: number) => {
    setLoading(true);
    
    // Simulate payment process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    updateUser({
      isPaid: true,
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    });
    
    toast({
      title: "Upgrade successful!",
      description: `You've successfully upgraded to the ${planName} plan.`,
    });
    
    setLoading(false);
  };

  const handleCancelSubscription = () => {
    updateUser({ isPaid: false });
    toast({
      title: "Subscription cancelled",
      description: "Your subscription has been cancelled. You can still use the service until your current period ends.",
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing information</p>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">
                    {user?.isPaid ? 'Pro Plan' : 'Free Trial'}
                  </h3>
                  {user?.isPaid ? (
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  ) : isTrialActive ? (
                    <Badge className="bg-blue-100 text-blue-800">Trial Active</Badge>
                  ) : (
                    <Badge variant="destructive">Trial Expired</Badge>
                  )}
                </div>
                <p className="text-gray-600">
                  {user?.isPaid 
                    ? 'Your subscription is active and will renew automatically.'
                    : isTrialActive
                      ? `Your free trial ends in ${trialDaysLeft} days.`
                      : 'Your free trial has expired. Please upgrade to continue using the service.'
                  }
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {user?.isPaid ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    Cancel Subscription
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {isTrialActive 
                        ? `${trialDaysLeft} days left`
                        : 'Trial expired'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        {!isTrialExpired && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Messages This Month</p>
                    <p className="text-2xl font-bold">127 / {user?.isPaid ? '1,000' : '100'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Groups Connected</p>
                    <p className="text-2xl font-bold">8 / {user?.isPaid ? '25' : '5'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">API Calls</p>
                    <p className="text-2xl font-bold">1,234</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Plans */}
        {!user?.isPaid && (
          <div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Choose Your Plan</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.name} 
                  className={`relative ${plan.popular ? 'ring-2 ring-green-500 shadow-lg' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-green-600 text-white px-4 py-1">
                        <Crown className="h-3 w-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-600">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      onClick={() => handleUpgrade(plan.name, plan.price)}
                      disabled={loading}
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-gray-900 hover:bg-gray-800'
                      }`}
                    >
                      {loading ? 'Processing...' : `Upgrade to ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Trial Expired Warning */}
        {isTrialExpired && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="p-3 bg-red-100 rounded-full w-fit mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Your trial has expired
              </h3>
              <p className="text-red-700 mb-6">
                Please upgrade to a paid plan to continue using WhatsApp Scheduler.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => handleUpgrade('Pro', 49)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Upgrade to Pro - $49/month'}
                </Button>
                <Button
                  onClick={() => handleUpgrade('Starter', 19)}
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Start with Starter - $19/month'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        {user?.isPaid && (
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <p className="font-medium">Pro Plan - Monthly</p>
                    <p className="text-sm text-gray-600">Dec 13, 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$49.00</p>
                    <Badge variant="outline" className="text-green-600">Paid</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <p className="font-medium">Pro Plan - Monthly</p>
                    <p className="text-sm text-gray-600">Nov 13, 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$49.00</p>
                    <Badge variant="outline" className="text-green-600">Paid</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Billing;

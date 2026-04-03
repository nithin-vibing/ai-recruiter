'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getUsage } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, ArrowLeft } from 'lucide-react';

const FREE_FEATURES = [
  '3 projects per month',
  '100 resumes per month',
  'AI-powered scoring',
  'Rubric generation',
  'PDF resume viewing',
  'CSV export',
];

const PRO_FEATURES = [
  'Unlimited projects',
  '500 resumes per month',
  'Everything in Free',
  'Per-criterion score breakdown',
  'Priority processing',
  'Email support',
];

// Placeholder until Stripe is integrated — swap this for a real plan lookup
type UserPlan = 'free' | 'pro' | 'team';
const getUserPlan = (): UserPlan => 'free';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [usage, setUsage] = useState<{ projects_created: number; resumes_screened: number } | null>(null);
  const userPlan = getUserPlan();

  useEffect(() => {
    if (user?.id) {
      getUsage(user.id).then(setUsage).catch(console.error);
    }
  }, [user]);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Simple, transparent pricing
        </h1>
        <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
          Screen resumes with AI for free. Upgrade when you need more.
        </p>
      </div>

      {/* Current usage bar */}
      {usage && (
        <Card className="mb-8 border-muted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Your usage this month</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Projects</span>
                  <span className="font-medium">{usage.projects_created} / 3</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-electric-blue rounded-full transition-all"
                    style={{ width: `${Math.min(100, (usage.projects_created / 3) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Resumes</span>
                  <span className="font-medium">{usage.resumes_screened} / 100</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-electric-blue rounded-full transition-all"
                    style={{ width: `${Math.min(100, (usage.resumes_screened / 100) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free tier */}
        <Card className={`border-2 relative ${userPlan === 'free' ? 'border-muted' : 'border-muted opacity-75'}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl">Free</CardTitle>
              {userPlan === 'free' && <Badge variant="secondary">Current Plan</Badge>}
            </div>
            <div className="mt-4">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Perfect for trying AI-powered screening
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-full mt-6"
              disabled
            >
              Current Plan
            </Button>
          </CardContent>
        </Card>

        {/* Pro tier */}
        <Card className="border-2 border-electric-blue relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            {userPlan === 'pro' ? (
              <Badge className="bg-success text-white border-0 px-3">Current Plan</Badge>
            ) : (
              <Badge className="bg-electric-blue text-white border-0 px-3">
                <Zap className="h-3 w-3 mr-1" />
                Recommended
              </Badge>
            )}
          </div>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl">Pro</CardTitle>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-bold">$29</span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              For recruiters who screen multiple roles weekly
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-electric-blue shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {userPlan === 'pro' ? (
              <Button className="w-full mt-6" variant="outline" disabled>
                Current Plan
              </Button>
            ) : (
              <Button
                className="w-full mt-6 bg-electric-blue hover:bg-electric-blue/90"
                asChild
              >
                <a href="mailto:nithin@shortlistai.com?subject=ShortlistAI Pro — Early Access&body=Hi, I'd like to upgrade to ShortlistAI Pro.">
                  Get Early Access — $29/mo
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FAQ / Trust section */}
      <div className="mt-12 text-center text-sm text-muted-foreground space-y-2">
        <p>No credit card required for the free plan. Cancel Pro anytime.</p>
        <p>
          Questions?{' '}
          <a href="mailto:nithin@shortlistai.com" className="text-electric-blue hover:underline">
            Get in touch
          </a>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Zap, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import { DisplayTitle } from '@/components/ui/DisplayTitle';
import { SpecTile } from '@/components/ui/SpecTile';
import { SpecGrid } from '@/components/ui/SpecGrid';
import { InfoRow } from '@/components/ui/InfoRow';
import { PageContainer } from '@/components/layout/PageContainer';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-8 border-b border-border last:border-0">
      <EyebrowLabel className="mb-3">{title}</EyebrowLabel>
      {children}
    </section>
  );
}

const SWATCHES = [
  { name: 'ink',          bg: 'bg-ink',          text: 'text-white',    label: '#0c1611' },
  { name: 'ink-soft',     bg: 'bg-ink-soft',      text: 'text-white',    label: '#28332c' },
  { name: 'muted',        bg: 'bg-muted',         text: 'text-white',    label: '#6d7a72' },
  { name: 'volt',         bg: 'bg-volt',          text: 'text-ink',      label: '#10d96a' },
  { name: 'volt-deep',    bg: 'bg-volt-deep',     text: 'text-white',    label: '#0a9e4c' },
  { name: 'volt-soft',    bg: 'bg-volt-soft',     text: 'text-volt-deep',label: '#e4faee' },
  { name: 'surface-0',    bg: 'bg-surface-0 border border-border', text: 'text-ink', label: '#ffffff' },
  { name: 'surface-1',    bg: 'bg-surface-1',     text: 'text-ink',      label: '#f5f6f5' },
  { name: 'surface-2',    bg: 'bg-surface-2',     text: 'text-ink',      label: '#ebebeb' },
  { name: 'danger',       bg: 'bg-danger',        text: 'text-white',    label: '#dc2626' },
  { name: 'danger-soft',  bg: 'bg-danger-soft',   text: 'text-danger',   label: '#fef2f2' },
];

export default function DesignPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <PageContainer>
      <div className="mb-8">
        <EyebrowLabel className="mb-2">Design System</EyebrowLabel>
        <DisplayTitle>Foundation</DisplayTitle>
        <p className="mt-2 text-base text-muted">
          Tokens, primitives, and layout components for the EV Charging app.
        </p>
      </div>

      <Section title="Color Palette">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SWATCHES.map(s => (
            <div key={s.name} className={`${s.bg} rounded-token p-3`}>
              <p className={`text-xs font-medium ${s.text}`}>{s.name}</p>
              <p className={`text-xs ${s.text} opacity-70`}>{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-4">
          <div>
            <EyebrowLabel className="mb-1">EyebrowLabel</EyebrowLabel>
            <p className="text-xs text-muted">Uppercase tracking-widest, weight 500, muted</p>
          </div>
          <DisplayTitle>DisplayTitle — 3xl / 500</DisplayTitle>
          <h1 className="text-2xl font-medium text-ink">Heading h1 — 2xl / 500</h1>
          <h2 className="text-xl font-medium text-ink">Heading h2 — xl / 500</h2>
          <p className="text-base text-ink">Body — 16px / 400 / line-height 1.6</p>
          <p className="text-sm font-medium text-muted">Small label — 14px / 500 / muted</p>
          <p className="text-xs text-muted">XS — 12px / 400 / muted</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="primary">Primary sm</Button>
            <Button size="sm" variant="secondary">Secondary sm</Button>
            <Button size="sm" variant="ghost">Ghost sm</Button>
            <Button size="sm" variant="danger">Danger sm</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Button className="w-full">Full width primary</Button>
        </div>
      </Section>

      <Section title="Cards">
        <div className="space-y-4">
          <Card>
            <p className="text-sm font-medium text-ink">Card with default padding</p>
            <p className="text-xs text-muted mt-1">bg-surface-0 · rounded-token-lg · shadow-card</p>
          </Card>
          <Card padding={false}>
            <div className="h-24 bg-surface-1 rounded-t-token-lg" />
            <div className="p-4">
              <p className="text-sm font-medium text-ink">Card without padding</p>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Spec Grid">
        <SpecGrid>
          <SpecTile label="Connector" value="Type 2 AC" />
          <SpecTile label="Max power" value="7.4 kW" />
          <SpecTile label="Rate" value="₹12/kWh" />
          <SpecTile label="Parking" value="Free" />
        </SpecGrid>
      </Section>

      <Section title="Info Rows">
        <Card>
          <InfoRow icon={MapPin} label="Location" value="Sector 15, Gurugram" />
          <InfoRow icon={Zap} label="Connector" value="Type 2 AC" />
          <InfoRow icon={Clock} label="Available" value="Mon–Fri, 6am–10pm" />
        </Card>
      </Section>

      <Section title="Avatars">
        <div className="flex items-end gap-4">
          <Avatar avatarUrl={null} name="Akash Kumar" size="sm" />
          <Avatar avatarUrl={null} name="Akash Kumar" size="md" />
          <Avatar avatarUrl={null} name="Akash Kumar" size="lg" />
        </div>
      </Section>

      <Section title="Skeletons">
        <div className="space-y-4">
          <SkeletonText lines={3} />
          <SkeletonCard />
        </div>
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open Sheet
        </Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Sheet title"
        >
          <SkeletonText lines={5} />
          <div className="mt-6">
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              Confirm
            </Button>
          </div>
        </Sheet>
      </Section>

      <Section title="Shadows & Radius">
        <div className="flex flex-wrap gap-4">
          <div className="w-32 h-16 bg-surface-0 rounded-token shadow-card flex items-center justify-center">
            <span className="text-xs text-muted">shadow-card</span>
          </div>
          <div className="w-32 h-16 bg-surface-0 rounded-token-lg shadow-float flex items-center justify-center">
            <span className="text-xs text-muted">shadow-float</span>
          </div>
          <div className="w-16 h-16 bg-surface-2 rounded-token-sm flex items-center justify-center">
            <span className="text-xs text-muted">sm</span>
          </div>
          <div className="w-16 h-16 bg-surface-2 rounded-token flex items-center justify-center">
            <span className="text-xs text-muted">base</span>
          </div>
          <div className="w-16 h-16 bg-surface-2 rounded-token-lg flex items-center justify-center">
            <span className="text-xs text-muted">lg</span>
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}

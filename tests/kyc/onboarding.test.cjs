const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomInt, createHash } = require('node:crypto');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

const origin = 'http://localhost:3000';
const project = 'https://mqlzsxwntsnhwfxbyyaq.supabase.co';
function checked(result) {
  if (result.error) throw Error(result.error.message);
  return result.data;
}

test('host submits KYC, corrects two reviews and becomes verified', { timeout: 240000 }, async t => {
  const env = loadEnvConfig(process.cwd(), true).combinedEnv;
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin, project);
  const db = createClient(project, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  checked(await db.from('kyc_submissions').select('updated_at').limit(0));
  const browser = await chromium.launch({ executablePath: chromium.executablePath() });
  t.after(() => browser.close());
  const host = await browser.newPage({ baseURL: origin });
  const reviewer = await browser.newPage({ baseURL: origin });
  const uploads = new Set();
  const uploadResponse = res => res.request().method() === 'POST' && res.url() ===
    `https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const cleanupAccounts = [];
  t.after(async () => {
    for (const account of cleanupAccounts) {
      checked(await db.from('users').update({ is_admin: false }).eq('id', account.id));
      checked(await db.auth.admin.deleteUser(account.id));
    }
    // Remove only this run's synthetic records, in foreign-key order.
    const ids = cleanupAccounts.map(a => a.id);
    if (ids.length) {
      checked(await db.from('audit_log').delete().in('admin_user_id', ids));
      checked(await db.from('kyc_submissions').delete().in('user_id', ids));
      checked(await db.from('notifications').delete().in('user_id', ids));
      checked(await db.from('chargers').delete().in('lender_id', ids));
      checked(await db.from('users').delete().in('id', ids));
    }
  });
  t.after(async () => {
    for (const public_id of uploads) {
      const timestamp = Math.floor(Date.now()/1000).toString();
      const signature = createHash('sha1').update(`public_id=${public_id}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`).digest('hex');
      const response = await fetch(`https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/destroy`, {
        method: 'POST', body: new URLSearchParams({ public_id, timestamp, signature, api_key: env.CLOUDINARY_API_KEY }),
      });
      assert.equal((await response.json()).result, 'ok', 'Remove synthetic upload');
    }
  });

  async function newAccount(page, name, isAdmin) {
    const username = 'kyc_' + randomUUID().replaceAll('-', '').slice(0,20);
    const pin = String(randomInt(1000,10000));
    const response = await page.request.post('/api/auth/pin', { data: {
      action: 'register', username, pin, phone: '9' + randomInt(100000000,1000000000),
    } });
    assert.equal(response.status(), 200, 'Register temporary account');
    const account = checked(await db.from('users').select('id').eq('username', username).single());
    cleanupAccounts.push(account);
    assert.equal((await page.request.patch('/api/profile', { data: { name } })).status(), 200);
    if (isAdmin) {
      checked(await db.from('users').update({ is_admin: true }).eq('id', account.id));
      checked(await db.auth.admin.updateUserById(account.id, { user_metadata: { is_admin: true } }));
    }
    assert.equal((await page.request.post('/api/auth/pin', { data: { action: 'login', username, pin } })).status(), 200);
    return account.id;
  }
  const hostId = await newAccount(host, 'Journey Host', false);
  const adminId = await newAccount(reviewer, 'Journey Reviewer', true);
  await host.goto('/profile');
  await host.getByRole('button', { name: /Turn on hosting/ }).click();
  await host.getByRole('link', { name: 'Start verification' }).click();
  const draft = await host.request.post('/api/chargers', { data: {
    title: 'Synthetic KYC draft', chargerType: 'AC_7kW', connectorTypes: ['CCS2'], pricePerKwh: 12,
    address: 'QA test fixture in New Delhi', latitude: 28.6, longitude: 77.2,
    photos: [origin + '/brand/kirin-icon.svg'], instructions: 'Synthetic test only.',
    availability: [{ daysOfWeek: [1], startTime: '09:00', endTime: '17:00' }],
  } });
  assert.ok(draft.ok(), 'Unverified host can save a draft listing');


  async function upload(label) {
    const data = await host.evaluate(label => {
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0,0,480,120);
      ctx.fillStyle = 'black'; ctx.font = '20px sans-serif'; ctx.fillText('TEST ONLY - ' + label, 20,65);
      return canvas.toDataURL('image/png').split(',')[1];
    }, label);
    const [res] = await Promise.all([
      host.waitForResponse(uploadResponse),
      host.getByLabel({ Aadhaar: 'Aadhaar photo', PAN: 'PAN card photo', Selfie: 'Your selfie' }[label], { exact: true }).setInputFiles({ name: label + '.png', mimeType: 'image/png', buffer: Buffer.from(data,'base64') }),
    ]);
    assert.equal(res.status(), 200, 'Synthetic document upload');
    uploads.add((await res.json()).public_id);
  }

  for (const [action, status, reason] of [
    ['Reject','rejected','Please replace the unreadable test image.'],
    ['Request resubmission','resubmission_required','Please include the full test image.'],
    ['Approve KYC','approved',null],
  ]) {
    await upload('Aadhaar');
    await host.locator('#aadhaar_last_4').fill('0000');
    const next = host.getByRole('button',{ name: 'Next',exact:true });
    await next.click();
    await upload('PAN');
    await host.locator('#pan_number').fill('AAAAA0000A');
    await next.click();
    await upload('Selfie');
    await next.click();
    await host.getByRole('button',{ name:'UPI', exact:true }).click();
    await host.locator('#upi_id').fill('testhost@example');
    await next.click();
    const [submission] = await Promise.all([
      host.waitForResponse(res => res.url().endsWith('/api/lender/kyc') && res.request().method() === 'POST'),
      host.getByRole('button',{name:'Submit for verification'}).click(),
    ]);
    assert.equal(submission.status(), 200);
    const {id} = await submission.json();
    await host.getByText('Under review',{exact:true}).waitFor();
    const premature = checked(await db.from('notifications').select('id').eq('user_id',hostId).eq('type','kyc_approved'));
    assert.equal(premature.length,0);
    assert.equal((await host.request.post('/api/lender/kyc',{data:{}})).status(),409);
    assert.equal((await host.request.post('/api/admin/kyc/'+id+'/approve')).status(),403);
    await reviewer.goto('/admin/kyc?status=pending');
    await reviewer.locator(`a[href="/admin/kyc/${id}"]`).click();
    await reviewer.getByRole('button',{name:action,exact:true}).waitFor();
    const links = await reviewer.getByRole('link',{name:'Full size'}).all();
    assert.equal(links.length, 3);
    for (const link of links) {
      const doc = await reviewer.request.get(await link.getAttribute('href'));
      assert.ok(doc.ok(), 'Reviewer can open the uploaded document');
    }
    const decision = reviewer.waitForResponse(res => res.url().includes('/api/admin/kyc/'+id+'/') && res.request().method() === 'POST');
    await reviewer.getByRole('button',{name:action,exact:true}).click();
    if (reason) {
      await reviewer.locator('textarea').fill(reason);
      await reviewer.getByRole('button',{name:'Confirm',exact:true}).click();
    }
    const decisionResponse = await decision;
    assert.equal(decisionResponse.status(),200, action + ': ' + (await decisionResponse.text()));
    await reviewer.waitForURL(url => url.pathname === '/admin/kyc', {waitUntil:'domcontentloaded'});
    const row = checked(await db.from('kyc_submissions').select('status,reviewed_by,rejection_reason').eq('id',id).single());
    assert.equal(row.status,status);
    assert.equal(row.reviewed_by,adminId);
    assert.equal(row.rejection_reason,reason);
    assert.equal((await reviewer.request.post('/api/admin/kyc/'+id+'/reject',{data:{reason:'Stale decision'}})).status(),409);
    await host.goto('/profile');
    const profile = checked(await db.from('users').select('kyc_status').eq('id',hostId).single());
    assert.equal(profile.kyc_status, reason ? 'rejected' : 'approved');
    const listing = checked(await db.from('chargers').select('status').eq('lender_id',hostId).single());
    assert.equal(listing.status, reason ? 'draft' : 'active');
    if (reason) {
      await host.getByText('Reason: '+reason,{exact:true}).waitFor();
      await host.getByRole('link',{name:'Resubmit documents'}).click();
    } else await host.getByText('Verified',{exact:true}).waitFor();
  }
  const approvals = checked(await db.from('notifications').select('id').eq('user_id',hostId).eq('type','kyc_approved'));
  assert.equal(approvals.length,1);
  const audit = checked(await db.from('audit_log').select('action_type').eq('admin_user_id',adminId)
    .eq('target_user_id',hostId).order('created_at'));
  assert.deepEqual(audit.map(row => row.action_type), ['kyc_rejected','kyc_resubmission_required','kyc_approved']);
});

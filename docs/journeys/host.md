# Host journey

## Set up hosting

1. Open **Profile** and select **Turn on hosting**. Complete verification and provide payout details through the hosting setup.
2. Open the hosting workspace, go to **Chargers**, and start a listing. Set its connector, power, price, location, photos, availability, and instructions. Review and submit the listing. Set weekly operating hours in IST or choose **24/7 always**. An active listing needs at least one active shift to accept bookings. Editing hours changes future booking availability and preserves existing reservations.

For the booking test, a synthetic host with approved test payout details and a dedicated charger was seeded. The onboarding and verification screens still need their own run.

## Accept a paid booking

1. Open the incoming request in **Hosting → Bookings**. Check the charger, driver, and reserved time.
2. Select **Accept booking** within 30 minutes of the request. Check that the status changes from **Pending** to **Confirmed** and the timeline shows when it was accepted. If the booking changed while the request was open, refresh it to see the current status.

## Run the charging session

1. When **Start session** becomes available, select it. The action is available from 30 minutes before the reserved start through 30 minutes after the reserved end. The session waits for the driver to confirm.
2. After the driver confirms, check that the session is **In progress**.
3. Select **End session** when charging is done. The session waits for the driver to confirm the end, then becomes **Completed**.
4. Review the completed booking and earnings. With approved payout details, completion queues the host share for [admin processing](admin.md).

For booking `038abc7a-cdbb-4898-be25-ad32b1499e84`, the host used an authenticated session with the app APIs for acceptance, start, and end. The driver confirmed both steps in the browser. Supabase recorded one pending ₹35.70 payout from the ₹42 test payment after a ₹6.30 platform fee. The synthetic charger was paused after the run. The test host, bookings, and payout remain in the configured test backend.

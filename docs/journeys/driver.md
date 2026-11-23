# Driver journey

## Sign in and set up a vehicle

1. Open `/auth` and choose phone OTP or username and PIN. With OTP, enter the mobile number and verification code. For PIN signup, choose **Create an account** and enter a username, four-digit PIN, and mobile number. The phone number is saved for booking contact without sending a code.
2. A new driver enters a name and lands on Home. If they leave OTP signup before saving a name, signing in again resumes that step. A returning driver lands on Home with their saved profile.
3. Open **Profile → My Vehicles → Add vehicle**. Enter the make, model, and connector types, then save. The first vehicle becomes the default. Use the vehicle list to edit it or choose another default.

The returning session and first vehicle were verified in the browser. The CCS2 test vehicle stayed the default after reload.

## Find a charger

1. Choose **Find a charger** on Home to search nearby, or **Plan a trip** to search along a route. For a nearby search, choose a location and radius. For a route, choose the start and destination, then adjust coverage and off-route distance.
2. Apply the default vehicle suggestion or select connectors manually. Open a matching charger and check the connector, power, and rate before selecting **Book now**.

The vehicle filter reduced the nearby results from 25 to 5. The charger detail and booking form both showed that it was compatible with the test vehicle.

## Select a slot and pay

1. Choose a future date, start time, and duration or budget. The entire slot must fit within the host’s published hours (IST). A session can end at closing time. A gap between shifts requires a separate booking. Check the vehicle and estimated total. If availability cannot be loaded, choose **Try again**. An exact 30-minute opening supports **30 min**. A custom budget must be a positive whole-rupee amount that covers the minimum duration. To run the full test immediately, choose a slot starting within 30 minutes and make sure the test host is ready to accept it.
2. Select **Pay & book**. For a sandbox run, confirm **Test Mode** in Razorpay, choose **Netbanking** and a test bank, then select **Success** on the demo bank page. [Razorpay test integration](https://razorpay.com/blog/payment-gateway-testing)
3. Return to Kirin and confirm that the booking shows **Pending** and the payment amount. The booking moves to **Confirmed** after the host accepts. The confirmed booking includes the charger address and host contact.

On 23 November 2026, two sandbox checkouts at ₹42 each produced pending bookings for 30-minute slots on the synthetic 7 kW charger at ₹12/kWh. Razorpay captured the payment for the completed booking. The spare booking was cancelled in the free window, and the app and Razorpay both recorded its ₹42 refund.

## Start and finish charging

1. After the host selects **Start session**, open the booking and select **Confirm start**. The booking moves to **In progress** and records the start time.
2. Open the live session to see elapsed time and estimated energy and cost.
3. When the host selects **End session**, open the live session and select **Confirm end**. The app returns to the completed booking. The driver can also use **Stop charging** while the session is active.
4. Open **Payment Receipt** to view the charged amount and payment method. The completed booking also offers ratings for the charging experience and host. Reopen the booking from Activity to review its timeline.

The host-led path was verified through completion for booking `038abc7a-cdbb-4898-be25-ad32b1499e84`. The driver confirmed both start and end in the browser. The booking recorded an estimated 0.08 kWh and the ₹42 advance payment. The receipt displayed ₹42 and Net Banking, and Activity showed both the completed and cancelled bookings. See the [host steps](host.md) for the matching actions.

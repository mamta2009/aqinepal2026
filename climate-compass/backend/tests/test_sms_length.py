from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import sms_length  # noqa: E402


class SmsLengthTest(unittest.TestCase):
    def test_gsm_160_is_one_sms(self) -> None:
        text = "A" * 160
        self.assertEqual(sms_length.sms_encoding(text), "gsm")
        self.assertTrue(sms_length.fits_single_sms(text))
        self.assertEqual(sms_length.fit_to_single_sms(text), text)

    def test_gsm_161_is_truncated_to_one_sms(self) -> None:
        text = "A" * 161
        fitted = sms_length.fit_to_single_sms(text)
        self.assertLessEqual(sms_length.gsm_septet_length(fitted), 160)
        self.assertTrue(fitted.endswith("..."))
        self.assertTrue(sms_length.fits_single_sms(fitted))

    def test_extended_gsm_counts_as_two_septets(self) -> None:
        # { is GSM extended (2 septets); 80 braces = 160 septets.
        text = "{" * 80
        self.assertEqual(sms_length.gsm_septet_length(text), 160)
        self.assertTrue(sms_length.fits_single_sms(text))
        too_long = "{" * 81
        fitted = sms_length.fit_to_single_sms(too_long)
        self.assertLessEqual(sms_length.gsm_septet_length(fitted), 160)

    def test_emoji_forces_unicode_70(self) -> None:
        text = "Alert 🟢 Kathmandu HIGH AQI 180 check oxygen now please extra words"
        self.assertEqual(sms_length.sms_encoding(text), "unicode")
        fitted = sms_length.fit_to_single_sms(text)
        # Emoji is stripped so remaining GSM can use 160.
        self.assertEqual(sms_length.sms_encoding(fitted), "gsm")
        self.assertTrue(sms_length.fits_single_sms(fitted))
        self.assertNotIn("🟢", fitted)

    def test_nepali_unicode_capped_at_70(self) -> None:
        text = "काठमाडौं वायु गुणस्तर चेतावनी " * 8
        self.assertEqual(sms_length.sms_encoding(text), "unicode")
        fitted = sms_length.fit_to_single_sms(text)
        self.assertLessEqual(len(fitted), 70)
        self.assertTrue(sms_length.fits_single_sms(fitted))

    def test_verification_otp_fits_gsm(self) -> None:
        text = "Climate Compass verification code: 123456. Valid 24 hours."
        self.assertEqual(sms_length.sms_encoding(text), "gsm")
        self.assertTrue(sms_length.fits_single_sms(text))
        self.assertLessEqual(sms_length.gsm_septet_length(text), 160)

    def test_compact_air_alert_is_one_gsm_sms(self) -> None:
        body = sms_length.compact_alert_sms("air", "Kathmandu", "HIGH", "185")
        self.assertEqual(sms_length.sms_encoding(body), "gsm")
        self.assertTrue(sms_length.fits_single_sms(body))
        self.assertIn("Kathmandu", body)
        self.assertIn("185", body)

    def test_compact_heat_alert_is_one_gsm_sms(self) -> None:
        body = sms_length.compact_alert_sms(
            "heat", "Pokhara", "SEVERE", "41.2 C effective (snapshot)"
        )
        self.assertEqual(sms_length.sms_encoding(body), "gsm")
        self.assertTrue(sms_length.fits_single_sms(body))
        self.assertIn("41.2", body)
        self.assertNotIn("effective", body)

    def test_long_emoji_broadcast_uses_compact_sms(self) -> None:
        long_msg = """🟢 AIR QUALITY ALERT

🏙️ Location: Kathmandu
📊 Level: HIGH
🔢 AQI / index: 210
📋 Recommended actions:
• Check oxygen stock
🔗 Dashboard: http://localhost:3000/dashboard
"""
        body = sms_length.sms_body_for_broadcast(
            long_msg,
            hazard="air",
            city="Kathmandu",
            level="HIGH",
            headline="210",
        )
        self.assertTrue(sms_length.fits_single_sms(body))
        self.assertEqual(sms_length.sms_encoding(body), "gsm")
        self.assertTrue(body.startswith("CC AIR ALERT"))

    def test_short_override_is_kept(self) -> None:
        override = "Kathmandu HIGH AQI 190. Limit outdoor activity."
        body = sms_length.sms_body_for_broadcast(
            override,
            hazard="air",
            city="Kathmandu",
            level="HIGH",
            headline="190",
        )
        self.assertEqual(body, override)


if __name__ == "__main__":
    unittest.main()

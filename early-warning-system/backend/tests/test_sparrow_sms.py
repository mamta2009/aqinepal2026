from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import sparrow_sms  # noqa: E402


class SparrowSmsHelpersTest(unittest.TestCase):
    def test_nepal_msisdn_from_e164_and_local(self) -> None:
        self.assertEqual(sparrow_sms.nepal_msisdn_10("+9779801234567"), "9801234567")
        self.assertEqual(sparrow_sms.nepal_msisdn_10("9779801234567"), "9801234567")
        self.assertEqual(sparrow_sms.nepal_msisdn_10("9801234567"), "9801234567")
        self.assertEqual(sparrow_sms.nepal_msisdn_10("09801234567"), "9801234567")
        self.assertIsNone(sparrow_sms.nepal_msisdn_10("+14155552671"))
        self.assertIsNone(sparrow_sms.nepal_msisdn_10(""))

    def test_configured_ignores_placeholders(self) -> None:
        env = {
            "SMS_PROVIDER": "auto",
            "SPARROW_SMS_TOKEN": "your_token",
            "SPARROW_SMS_FROM": "Demo",
        }
        with patch.dict(os.environ, env, clear=False):
            self.assertFalse(sparrow_sms.sparrow_configured())
            self.assertFalse(sparrow_sms.should_use_sparrow())

    def test_auto_provider_uses_sparrow_when_credentials_set(self) -> None:
        env = {
            "SMS_PROVIDER": "auto",
            "SPARROW_SMS_TOKEN": "real-token-value",
            "SPARROW_SMS_FROM": "ClimateC",
        }
        with patch.dict(os.environ, env, clear=False):
            self.assertTrue(sparrow_sms.sparrow_configured())
            self.assertTrue(sparrow_sms.should_use_sparrow())
            self.assertEqual(sparrow_sms.active_sms_provider(), "sparrow")

    def test_twilio_provider_skips_sparrow(self) -> None:
        env = {
            "SMS_PROVIDER": "twilio",
            "SPARROW_SMS_TOKEN": "real-token-value",
            "SPARROW_SMS_FROM": "ClimateC",
        }
        with patch.dict(os.environ, env, clear=False):
            self.assertTrue(sparrow_sms.sparrow_configured())
            self.assertFalse(sparrow_sms.should_use_sparrow())
            self.assertEqual(sparrow_sms.sms_provider_name(), "twilio")

    def test_explicit_sparrow_uses_sparrow(self) -> None:
        env = {
            "SMS_PROVIDER": "sparrow",
            "SPARROW_SMS_TOKEN": "real-token-value",
            "SPARROW_SMS_FROM": "ClimateC",
        }
        with patch.dict(os.environ, env, clear=False):
            self.assertTrue(sparrow_sms.should_use_sparrow())
            self.assertEqual(sparrow_sms.sms_provider_name(), "sparrow")

    def test_default_sms_provider_alias(self) -> None:
        env = {
            "SMS_PROVIDER": "",
            "DEFAULT_SMS_PROVIDER": "twilio",
            "SPARROW_SMS_TOKEN": "real-token-value",
            "SPARROW_SMS_FROM": "ClimateC",
        }
        with patch.dict(os.environ, env, clear=False):
            self.assertEqual(sparrow_sms.sms_provider_name(), "twilio")
            self.assertFalse(sparrow_sms.should_use_sparrow())


if __name__ == "__main__":
    unittest.main()

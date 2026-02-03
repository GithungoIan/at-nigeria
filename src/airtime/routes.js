const express = require("express");
const router = express.Router();
const airtimeService = require("./airtimeService");
const { validateAirtimeRequest } = require("../utils/validator");
const { logger } = require("../utils/logger");

router.post("/send", async (req, res, next) => {
  try {
    // const { error } = validateAirtimeRequest(req.body);
    // if (error) {
    //   logger.error("Validation error in send airtime endpoint", {
    //     error: error.details[0].message,
    //   });
    //   return res.status(400).json({
    //     status: "error",
    //     message: error.details[0].message,
    //   });
    // }

    const { phoneNumber, amount, currencyCode } = req.body;

    const result = await airtimeService.sendAirtime(
      phoneNumber,
      amount,
      currencyCode,
    );

    logger.info("Airtime Result", { result });

    res.status(200).json({
      status: "success",
      message: "Airtime sent successfully",
      data: result.data,
    });
  } catch (error) {
    logger.error("Error in send airtime endpoint", { error });
    res.status(500).json({
      status: "error",
      message: "Failed to send airtime",
      error: error.message,
    });
  }
});

router.post("/send-bulk", async (req, res) => {
  try {
    const { recipients } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Recipients must be a non-empty array",
      });
    }

    const result = await airtimeService.sendBulkAirtime(recipients);

    res.status(200).json({
      status: "success",
      message: "Bulk airtime sent successfully",
      data: result.data,
    });
  } catch (error) {
    logger.error("Error in bulk airtime endpoint", { error: error.message });
    res.status(500).json({
      status: "error",
      message: "Failed to send bulk airtime",
      error: error.message,
    });
  }
});


router.post("/referral-reward", async (req, res) => {
  try {
    const { phoneNumber, rewardAmount } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: "error",
        message: "Phone number is required",
      });
    }

    const result = await airtimeService.sendReferralReward(
      phoneNumber,
      rewardAmount,
    );

    res.status(200).json({
      status: "success",
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    logger.error("Error in referral reward endpoint", { error: error.message });
    res.status(500).json({
      status: "error",
      message: "Failed to send referral reward",
      error: error.message,
    });
  }
});


router.post("/redeem-points", async (req, res) => {
  try {
    const { phoneNumber, points, conversionRate } = req.body;

    if (!phoneNumber || !points) {
      return res.status(400).json({
        status: "error",
        message: "Phone number and points are required",
      });
    }

    const result = await airtimeService.redeemLoyaltyPoints(
      phoneNumber,
      points,
      conversionRate,
    );

    res.status(200).json({
      status: "success",
      message: result.message,
      pointsUsed: result.pointsUsed,
      airtimeAmount: result.airtimeAmount,
      data: result.data,
    });
  } catch (error) {
    logger.error("Error in points redemption endpoint", {
      error: error.message,
    });
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to redeem points",
      error: error.message,
    });
  }
});


router.post("/employee-incentives", async (req, res) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Employees array is required",
      });
    }

    const result = await airtimeService.sendEmployeeIncentives(employees);

    res.status(200).json({
      status: "success",
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    logger.error("Error in employee incentives endpoint", {
      error: error.message,
    });
    res.status(500).json({
      status: "error",
      message: "Failed to send employee incentives",
      error: error.message,
    });
  }
});

router.post("/callback", (req, res) => {
  try {
    const callbackData = req.body;

    logger.info("Received airtime callback", { callback: callbackData });

    const result = airtimeService.processCallback(callbackData);

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({
      status: "success",
      message: "Callback processed",
    });
  } catch (error) {
    logger.error("Error processing airtime callback", { error: error.message });
    // Still return 200 to avoid retries
    res.status(200).json({
      status: "error",
      message: "Error processing callback",
    });
  }
});

module.exports = router;

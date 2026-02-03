const { normalizePhoneNumber } = require("../utils/validator");
const { AIRTIME } = require("../utils/atClient");
const logger = require("../utils/logger");

class AirtimeService {
  // Send airtime to a single phone number
  async sendAirtime(phoneNumber, amount, currencyCode = "NGN") {
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      const options = {
        recipients: [
          {
            phoneNumber: normalizedPhone,
            amount: amount,
            currencyCode: currencyCode,
          },
        ],
      };

      logger.info("Sending airtime", {
        phoneNumber: normalizedPhone,
        amount,
        currencyCode,
      });

      const result = await AIRTIME.send(options);

      // Check if the response indicates failure even though no exception was thrown
      if (result.responses && result.responses[0]?.status === "Failed") {
        throw new Error(result.responses[0]?.errorMessage || "Airtime send failed");
      }

      logger.info("Airtime sent successfully", { result });

      return {
        success: true,
        data: result,
      };
      
    } catch (error) {
      logger.error("Error sending airtime", { error });
      throw error;
    }
  }

  // Send bulk airtime
  async sendBulkAirtime(recipients) {
    try {
      const normalizedRecipients = recipients.map((recipient) => ({
        phoneNumber: normalizePhoneNumber(recipient.phoneNumber),
        amount: recipient.amount,
        currencyCode: recipient.currencyCode || "NGN",
      }));

      const options = {
        recipients: normalizedRecipients,
      };

      logger.info("Sending bulk airtime", {
        recipientCount: normalizedRecipients.length,
      });

      const result = await AIRTIME.send(options);

      logger.info("Bulk airtime sent successfully", {
        numSent: result.numSent,
        totalAmount: result.totalAmount,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error("Error sending bulk airtime", { error: error.message });
      throw error;
    }
  }

  // Send referral reward airtime
  async sendReferralReward(phoneNumber, rewardAmount = 50) {
    try {
      const amount = `KES ${rewardAmount}`;

      const result = await this.sendAirtime(phoneNumber, amount, "KES");

      logger.info("Referral reward sent", {
        phoneNumber,
        amount: rewardAmount,
      });

      // In production: Update user's referral record in database
      // await updateReferralRecord(phoneNumber, rewardAmount);
      return {
        success: true,
        message: `Referral reward of ${amount} sent successfully`,
        data: result.data,
      };
    } catch (error) {
      logger.error("Error sending referral reward", { error: error.message });
      throw error;
    }
  }

  // Redeem loyalty points for airtime
  async redeemLoyaltyPoints(phoneNumber, points, conversionRate = 10) {
    try {
      const airtimeAmount = Math.floor(points / conversionRate);

      if (airtimeAmount < 10) {
        throw new Error(
          "Insufficient points for redemption. Minimum is 100 points.",
        );
      }

      const amount = `KES ${airtimeAmount}`;

      const result = await this.sendAirtime(phoneNumber, amount, "KES");

      logger.info("Loyalty points redeemed", {
        phoneNumber,
        points,
        airtimeAmount,
      });

      // In production: Deduct points from user's account
      // await deductLoyaltyPoints(phoneNumber, points);
      return {
        success: true,
        message: `${points} points redeemed for ${amount} airtime`,
        pointsUsed: points,
        airtimeAmount: airtimeAmount,
        data: result.data,
      };
    } catch (error) {
      logger.error("Error redeeming loyalty points", { error: error.message });
      throw error;
    }
  }

  // Process airtime callback
  processCallback(callbackData) {
    try {
      const {
        requestId,
        status,
        phoneNumber,
        amount,
        currencyCode,
        errorMessage,
      } = callbackData;

      logger.info("Processing airtime callback", {
        requestId,
        status,
        phoneNumber,
      });

      // In production: Update transaction status in database
      // await updateAirtimeTransaction(requestId, status, errorMessage);

      if (status === "Success") {
        logger.info("Airtime transaction successful", {
          requestId,
          phoneNumber,
          amount,
        });
      } else {
        logger.error("Airtime transaction failed", {
          requestId,
          errorMessage,
        });
      }

      return {
        success: true,
        processed: true,
      };
    } catch (error) {
      logger.error("Error processing airtime callback", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new AirtimeService();
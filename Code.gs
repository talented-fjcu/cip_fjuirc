/**
 * =========================================================================
 * 原資增能獎勵報到系統 - Google Apps Script (GAS) 後端核心
 * 試算表 ID: 1rrF5RzCDhMxfEnKyyq5-DU319b4umjr34EK8Y7FQjfk
 * 
 * 欄位結構 (共 7 欄)：
 * A (1): 編號
 * B (2): 組別
 * C (3): 身分證字號 (查詢比對鍵值)
 * D (4): 姓名
 * E (5): 獎勵項目
 * F (6): 報到時間 (簽到寫入目標)
 * G (7): 交通費核銷否
 * =========================================================================
 */

const SPREADSHEET_ID = "1rrF5RzCDhMxfEnKyyq5-DU319b4umjr34EK8Y7FQjfk";

/**
 * 處理 POST 請求 (主要 API 進入點)
 */
function doPost(e) {
  try {
    const contents = e.postData ? e.postData.contents : "{}";
    const request = JSON.parse(contents);
    const action = request.action;

    if (action === "processScan") {
      return jsonResponse(processScan(request.idNumber, request.lockedStages));
    } else if (action === "processWalkIn") {
      return jsonResponse(processWalkIn(request.idNumber));
    } else if (action === "getAdminData") {
      return jsonResponse(getAdminData());
    }

    return jsonResponse({ success: false, error: "未知的請求動作 (Unknown action)" });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * 處理 GET 請求 (僅提供基本狀態檢查，不對外開放名冊讀取與簽到)
 */
function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : "";
    if (action === "getAdminData" || action === "processScan" || action === "processWalkIn") {
      return jsonResponse({ success: false, error: "安全性限制：此動作僅支援 POST 請求" });
    }

    return jsonResponse({
      status: "online",
      message: "原資增能獎勵報到系統 GAS API 正常運行中"
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * 執行報到掃描
 * @param {string} idNumber 身分證字號
 * @param {Array} lockedStages 已鎖定截止之階數清單 (例如 ["第一階"])
 */
function processScan(idNumber, lockedStages) {
  if (!idNumber) {
    return { status: "not_found", message: "身分證字號不可為空" };
  }

  const cleanId = idNumber.toString().trim().toUpperCase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  // 第一列為表頭 (Row 0)，從第二列開始搜尋 (i = 1)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // C 欄為身分證字號 (Index 2)
    const targetId = row[2] ? row[2].toString().trim().toUpperCase() : "";

    if (targetId === cleanId) {
      const idNo = row[0] ? row[0].toString() : "";         // A: 編號
      const groupName = row[1] ? row[1].toString() : "";    // B: 組別
      const name = row[3] ? row[3].toString() : "";         // D: 姓名
      const reward = row[4] ? row[4].toString() : "";       // E: 獎勵項目
      let checkInTime = row[5] ? row[5] : "";               // F: 報到時間
      const isTravelPay = row[6] ? row[6].toString() : "";  // G: 交通費核銷否

      // 日期格式化處理
      if (checkInTime instanceof Date) {
        checkInTime = Utilities.formatDate(checkInTime, "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
      } else {
        checkInTime = checkInTime ? checkInTime.toString().trim() : "";
      }

      // 檢查此階是否已鎖定截止 (過號防護)
      if (lockedStages && Array.isArray(lockedStages) && lockedStages.indexOf(groupName) !== -1) {
        return {
          status: "locked",
          idNo: idNo,
          name: name,
          groupName: groupName,
          checkInTime: checkInTime,
          message: "此階段檢錄已截止鎖定（過號）"
        };
      }

      // 如果已經有報到時間，代表重複掃描
      if (checkInTime !== "") {
        return {
          status: "already",
          idNo: idNo,
          name: name,
          groupName: groupName,
          reward: reward,
          isTravelPay: isTravelPay,
          checkInTime: checkInTime
        };
      }

      // 首次報到：產生當前台灣時區時間
      const nowStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
      
      // 寫入 F 欄 (第 6 欄，列號為 i + 1)
      sheet.getRange(i + 1, 6).setValue(nowStr);
      SpreadsheetApp.flush();

      return {
        status: "success",
        idNo: idNo,
        name: name,
        groupName: groupName,
        reward: reward,
        isTravelPay: isTravelPay,
        checkInTime: nowStr
      };
    }
  }

  // 找不到該身分證
  return { status: "not_found" };
}

/**
 * 取得完整名單數據 (提供看板查詢)
 */
function getAdminData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const rawData = sheet.getDataRange().getValues();

    if (rawData.length <= 1) {
      return { success: false, error: "試算表中無資料 (只有標題列或為空)" };
    }

    const dataList = [];
    // 從第 2 列開始 (排除標題列)
    for (let i = 1; i < rawData.length; i++) {
      const r = rawData[i];
      // 忽略全空列
      if (!r[0] && !r[2] && !r[3]) continue;

      let checkInTimeStr = "";
      if (r[5] instanceof Date) {
        checkInTimeStr = Utilities.formatDate(r[5], "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
      } else if (r[5]) {
        checkInTimeStr = r[5].toString().trim();
      }

      dataList.push([
        r[0] ? r[0].toString() : "",               // 0: 編號
        r[1] ? r[1].toString() : "",               // 1: 組別
        "",                                        // 2: 身分證字號 (資安與個資保護：不對外傳輸敏感識別碼)
        r[3] ? r[3].toString() : "",               // 3: 姓名
        r[4] ? r[4].toString() : "",               // 4: 獎勵項目
        checkInTimeStr,                            // 5: 報到時間
        r[6] ? r[6].toString() : ""                // 6: 交通費核銷否
      ]);
    }

    return { success: true, data: dataList };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * 處理臨時報到：比對總表並追加新增至工作表1
 * @param {string} idNumber 身分證字號
 */
function processWalkIn(idNumber) {
  if (!idNumber) {
    return { status: "not_found", message: "身分證字號不可為空" };
  }

  const cleanId = idNumber.toString().trim().toUpperCase();
  const lock = LockService.getScriptLock();
  
  // 等待最多 10 秒，避免多人同時調檔導致編號衝突
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", message: "系統忙碌中，請稍後再試" };
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 取得「工作表1」
    const sheet1 = ss.getSheetByName("工作表1") || ss.getSheets()[0];
    const data1 = sheet1.getDataRange().getValues();

    // 1. 防重複檢查：檢查「工作表1」是否已存在該身分證 (第 3 欄 / Index 2)
    for (let i = 1; i < data1.length; i++) {
      const row = data1[i];
      const targetId = row[2] ? row[2].toString().trim().toUpperCase() : "";
      if (targetId === cleanId) {
        return {
          status: "already_exists",
          message: "此身分證字號已在名冊中，請勿重複新增！",
          idNo: row[0] ? row[0].toString() : "",
          groupName: row[1] ? row[1].toString() : "",
          name: row[3] ? row[3].toString() : "",
          checkInTime: row[5] ? row[5].toString() : ""
        };
      }
    }

    // 2. 查「總表」：取得母檔資料
    const masterSheet = ss.getSheetByName("總表");
    if (!masterSheet) {
      return { status: "error", message: "試算表中找不到名為『總表』的工作表分頁，請確認分頁名稱！" };
    }
    const masterData = masterSheet.getDataRange().getValues();

    // 總表結構 (共 12 欄)：
    // 0: 獎勵項目, 1: 項目, 2: 項目金額, 3: 獎勵事蹟, 4: 姓名, 5: 族名, 
    // 6: 身分證字號, 7: 族別, 8: 族群方言, 9: 行動電話, 10: 學校及服務單位, 11: 科系職稱
    let foundRecord = null;
    for (let j = 1; j < masterData.length; j++) {
      const mRow = masterData[j];
      const mId = mRow[6] ? mRow[6].toString().trim().toUpperCase() : "";
      if (mId === cleanId) {
        foundRecord = {
          reward: mRow[0] ? mRow[0].toString().trim() : "",
          rewardAmount: mRow[2] ? mRow[2].toString().trim() : "",
          rewardDesc: mRow[3] ? mRow[3].toString().trim() : "",
          name: mRow[4] ? mRow[4].toString().trim() : "",
          tribe: mRow[7] ? mRow[7].toString().trim() : ""
        };
        break;
      }
    }

    // 若總表找不到該身分證
    if (!foundRecord) {
      return { status: "not_found", message: "總表無此人資料，請洽大會服務台！" };
    }

    // 3. 計算新編號 F-XX (尋找工作表1中最大的 F- 編號)
    let maxFNum = 0;
    for (let k = 1; k < data1.length; k++) {
      const curIdNo = data1[k][0] ? data1[k][0].toString().trim() : "";
      const match = curIdNo.match(/^F-(\d+)$/i);
      if (match) {
        const numVal = parseInt(match[1], 10);
        if (numVal > maxFNum) maxFNum = numVal;
      }
    }
    const nextFNum = maxFNum + 1;
    const newIdNo = "F-" + (nextFNum < 100 ? String(nextFNum).padStart(2, "0") : String(nextFNum));

    // 4. 產生報到時間並組裝 11 欄新資料
    const nowStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");

    // 工作表1 欄位對應：
    // A (0): 編號 (F-XX)
    // B (1): 組別 ('第6階')
    // C (2): 身分證字號
    // D (3): 姓名
    // E (4): 獎勵項目
    // F (5): 報到時間 (填入當前時間，視為已完成報到)
    // G (6): 整隊確認 (空白)
    // H (7): 檢錄組確認 (空白)
    // I (8): 族別
    // J (9): 獎勵事蹟
    // K (10): 獎勵金額
    const newRow = [
      newIdNo,
      "第6階",
      cleanId,
      foundRecord.name,
      foundRecord.reward,
      nowStr,
      "",
      "",
      foundRecord.tribe,
      foundRecord.rewardDesc,
      foundRecord.rewardAmount
    ];

    sheet1.appendRow(newRow);
    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "臨時報到成功！已派發【第6階】號碼牌",
      idNo: newIdNo,
      groupName: "第6階",
      name: foundRecord.name,
      reward: foundRecord.reward,
      tribe: foundRecord.tribe,
      rewardAmount: foundRecord.rewardAmount,
      checkInTime: nowStr
    };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 輔助函式：產生 JSON 回應
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

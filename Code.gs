// Файл: Code.gs
function onOpen() {
  setupMenu();           // Добавление меню
  setupHeaders();        // Установка заголовков
}

// Меню для открытия формы и просмотра данных
function setupMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Агентство недвижимости')
    .addItem('Добавить запись', 'showForm')
    .addItem('Сделка', 'showDataView')
    .addItem('Встреча', 'showMeetingForm') // Добавлен пункт "Встреча"
    .addToUi();
}

// Установка заголовков колонок
function setupHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "База данных";
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  const headers = sheet.getRange("A1:K1").getValues()[0];
  if (headers.every(cell => !cell)) {
    sheet.getRange("A1:K1").setValues([[
      "ID", "Операция", "Тип недвижимости", "Адрес", "Цена",
      "Кто будет жить", "Имя", "Телефон", "Статус", "Ответственный", "Описание"
    ]]);
  }

  // Создание листа для сделок
  let dealsSheet = ss.getSheetByName("Сделки");
  if (!dealsSheet) {
    dealsSheet = ss.insertSheet("Сделки");
    // Заголовки для сделок
    dealsSheet.getRange("A1:M1").setValues([[
      "ID", "Тип сделки", "ID Стороны 1", "Сторона 1", "Телефон Стороны 1",
      "ID Стороны 2", "Сторона 2", "Телефон Стороны 2", "Цена",
      "Тип недвижимости", "Адрес", "Статус", "Ответственный"
    ]]);
  }

  // Создание листа для встреч
  let meetingsSheet = ss.getSheetByName("Встречи");
  if (!meetingsSheet) meetingsSheet = ss.insertSheet("Встречи");
  const meetingHeaders = meetingsSheet.getRange("A1:H1").getValues()[0];
  if (meetingHeaders.every(cell => !cell)) {
    meetingsSheet.getRange("A1:H1").setValues([[
      "ID", "ID Сделки", "Статус сделки", "Процент", "Ответственный", "Получено агентских", "Комментарий"
    ]]);
  }

  // Создание листа для дат
  let datesSheet = ss.getSheetByName("Даты");
  if (!datesSheet) {
    datesSheet = ss.insertSheet("Даты");
    datesSheet.getRange("A1:F1").setValues([[
      "ID", "ID сделки", "ID встречи", "Дата создания сделки", "Дата встречи", "Дата завершения сделки"
    ]]);
  }
}

// Открытие формы добавления записи
function showForm() {
  const html = HtmlService.createHtmlOutputFromFile('Form.html')
    .setTitle('Добавить запись');
  SpreadsheetApp.getUi().showSidebar(html);
}

// Открытие представления данных
function showDataView() {
  const html = HtmlService.createHtmlOutputFromFile('DataView.html')
    .setTitle('Новая сделка')
    .setWidth(800);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Открытие формы "Встреча"
function showMeetingForm() {
  const html = HtmlService.createHtmlOutputFromFile('MeetingForm.html')
    .setTitle('Форма встречи')
    .setWidth(900);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Добавление данных
function addData(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("База данных");
  const lastRow = sheet.getLastRow();
  let newId = 1;
  if (lastRow > 1) {
    const lastId = sheet.getRange(lastRow, 1).getValue();
    newId = typeof lastId === "number" ? lastId + 1 : 1;
  }
  const newRow = [
    newId,
    formData.operation,
    formData.propertyType,
    formData.address || "",
    formData.price,
    formData.who_will_live,
    formData.name,
    formData.phone,
    "активно",
    formData.responsible,
    formData.description
  ];
  sheet.appendRow(newRow);
  sheet.getRange(sheet.getLastRow(), 1).setNumberFormat("0");
}

// Получение всех данных
function getAllData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("База данных");
  const data = sheet.getDataRange().getValues();
  return data.slice(1); // Пропускаем заголовки
}

// Получение всех сделок
function getAllDeals() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Сделки");
  const data = sheet.getDataRange().getValues();
  return data.slice(1); // Пропускаем заголовки
}

// Поиск подходящих записей для сделки
function findMatchingRecords(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("База данных");
  const allData = sheet.getDataRange().getValues();
  const currentRecord = allData.find(r => r[0] === id);
  if (!currentRecord || currentRecord.length < 10) return [];
  const oppositeOperationMap = {
    "продать": "купить",
    "купить": "продать",
    "сдать": "арендовать",
    "арендовать": "сдать"
  };
  const targetOperation = oppositeOperationMap[currentRecord[1]] || currentRecord[1];
  return allData
    .filter(r => 
      r[1] === targetOperation && 
      r[2] === currentRecord[2] && 
      r[8] === "активно" && 
      r[0] !== id
    )
    .map(r => ({
      id: r[0],
      operation: r[1],
      propertyType: r[2],
      address: r[3],
      price: r[4],
      whoWillLive: r[5],
      name: r[6],
      phone: r[7],
      responsible: r[9]
    }));
}

// Создание сделки
function createDeal(dealData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dealsSheet = ss.getSheetByName("Сделки");
  let side1, side2;
  if (
    (dealData.sellerOperation === "продать" || dealData.sellerOperation === "сдать") &&
    (dealData.buyerOperation === "купить" || dealData.buyerOperation === "арендовать")
  ) {
    side1 = {
      id: dealData.sellerId,
      name: dealData.sellerName,
      phone: dealData.sellerPhone,
      operation: dealData.sellerOperation,
      responsible: dealData.sellerResponsible,
      price: dealData.price,
      propertyType: dealData.propertyType,
      address: dealData.address
    };
    side2 = {
      id: dealData.buyerId,
      name: dealData.buyerName,
      phone: dealData.buyerPhone,
      operation: dealData.buyerOperation,
      responsible: dealData.buyerResponsible
    };
  } else if (
    (dealData.buyerOperation === "продать" || dealData.buyerOperation === "сдать") &&
    (dealData.sellerOperation === "купить" || dealData.sellerOperation === "арендовать")
  ) {
    side1 = {
      id: dealData.buyerId,
      name: dealData.buyerName,
      phone: dealData.buyerPhone,
      operation: dealData.buyerOperation,
      responsible: dealData.buyerResponsible,
      price: dealData.price,
      propertyType: dealData.propertyType,
      address: dealData.address
    };
    side2 = {
      id: dealData.sellerId,
      name: dealData.sellerName,
      phone: dealData.sellerPhone,
      operation: dealData.sellerOperation,
      responsible: dealData.sellerResponsible
    };
  } else {
    throw new Error("Несоответствие операций между сторонами");
  }
  let dealType = "";
  if (side1.operation === "продать") {
    dealType = "Продажа";
  } else if (side1.operation === "сдать") {
    dealType = "Аренда";
  }
  let newId = 1;
  const lastRow = dealsSheet.getLastRow();
  if (lastRow > 1) {
    const lastId = dealsSheet.getRange(lastRow, 1).getValue();
    newId = typeof lastId === "number" ? lastId + 1 : 1;
  }
  let combinedResponsible = "";
  if (side1.responsible === side2.responsible) {
    combinedResponsible = side1.responsible;
  } else {
    combinedResponsible = `${side1.responsible}, ${side2.responsible}`;
  }
  const newRow = [
    newId,
    dealType,
    side1.id,
    side1.name,
    side1.phone,
    side2.id,
    side2.name,
    side2.phone,
    side1.price,
    side1.propertyType,
    side1.address,
    "активно",
    combinedResponsible
  ];
  dealsSheet.appendRow(newRow);
  updateStatus(side1.id, "в сделке");
  updateStatus(side2.id, "в сделке");
  return true;
}

// Изменение статуса
function updateStatus(id, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("База данных");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === parseInt(id)) {
      sheet.getRange(i + 1, 9).setValue(status);
      return true;
    }
  }
  return false;
}

// Назначение встречи
function scheduleMeeting(meetingData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const meetingsSheet = ss.getSheetByName("Встречи");
  const datesSheet = ss.getSheetByName("Даты");
  const dealsSheet = ss.getSheetByName("Сделки");

  // Генерация ID для встречи
  let meetingId = 1;
  const meetingLastRow = meetingsSheet.getLastRow();
  if (meetingLastRow > 1) {
    const lastMeetingId = meetingsSheet.getRange(meetingLastRow, 1).getValue();
    meetingId = typeof lastMeetingId === "number" ? lastMeetingId + 1 : 1;
  }

  // Получаем данные из сделки
  const dealData = dealsSheet.getRange(meetingData.dealId + 1, 1, 1, 13).getValues()[0];
  const dealCreationDate = new Date();

  // Добавляем запись в таблицу Встречи
  meetingsSheet.appendRow([
    meetingId,
    meetingData.dealId,
    "назначено", // Статус сделки
    meetingData.commissionPercent, // Процент
    dealData[12], // Ответственный из сделки
    0, // Получено агентских
    "" // Комментарий
  ]);

  // Обновляем статус сделки на "назначено"
  dealsSheet.getRange(meetingData.dealId + 1, 12).setValue("назначено");

  // Добавляем запись в таблицу Даты
  datesSheet.appendRow([
    datesSheet.getLastRow() > 1 ? datesSheet.getLastRow() : 1,
    meetingData.dealId,
    meetingId,
    dealCreationDate,
    new Date(meetingData.meetingDate), // Передаём объект Date
    null
  ]);

  return true;
}

// Обновление даты встречи
function updateMeetingDate(meetingData) {
  const datesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Даты");
  const data = datesSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === meetingData.meetingId) { // ID встречи
      datesSheet.getRange(i + 1, 5).setValue(meetingData.newDate); // Обновляем дату встречи
      return true;
    }
  }
  throw new Error("Встреча не найдена");
}

// Завершение встречи
function completeMeeting(meetingData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const meetingsSheet = ss.getSheetByName("Встречи");
  const dealsSheet = ss.getSheetByName("Сделки");
  const baseSheet = ss.getSheetByName("База данных");
  const datesSheet = ss.getSheetByName("Даты");

  const meetingRow = findMeetingRow(meetingData.meetingId, meetingsSheet);
  if (!meetingRow) throw new Error("Встреча не найдена");

  const meetingRecord = meetingsSheet.getRange(meetingRow + 1, 1, 1, 7).getValues()[0];
  const dealId = meetingRecord[1]; // ID Сделки
  const dealRow = dealsSheet.getRange(dealId + 1, 1, 1, 13).getValues()[0];

  // Обновляем статус встречи
  if (meetingData.success === "да") {
    meetingsSheet.getRange(meetingRow + 1, 3).setValue("состоялось"); // Статус сделки
  } else {
    meetingsSheet.getRange(meetingRow + 1, 3).setValue("не состоялось"); // Статус сделки
  }

  // Рассчитываем агентские
if (meetingData.success === "да") {
  const price = parseFloat(dealRow[8]); // Цена из сделки
  const commissionPercent = parseFloat(meetingRecord[3]); // Процент
  
  // Проверка на корректность данных
  if (isNaN(price) || isNaN(commissionPercent)) {
    meetingsSheet.getRange(meetingRow + 1, 6).setValue(0); // Получено агентских
    Logger.log("Ошибка: цена или процент некорректны");
  } else {
    const commission = (price * commissionPercent) / 100;
    meetingsSheet.getRange(meetingRow + 1, 6).setValue(commission); // Получено агентских
    Logger.log(`Агентские: ${price} * ${commissionPercent}% = ${commission}`);
  }
} else {
  meetingsSheet.getRange(meetingRow + 1, 6).setValue(0); // Получено агентских
  meetingsSheet.getRange(meetingRow + 1, 7).setValue(meetingData.reason || ""); // Комментарий
  Logger.log("Агентские сброшены до 0");
}

  // Обновляем статус в таблице Сделки
  if (meetingData.success === "да") {
    dealsSheet.getRange(dealId + 1, 12).setValue("состоялось");
  } else {
    dealsSheet.getRange(dealId + 1, 12).setValue("не состоялось");
  }

  // Обновляем статус в таблице База данных
  if (meetingData.success === "да") {
    const baseData = baseSheet.getDataRange().getValues();
    for (let i = 1; i < baseData.length; i++) {
      if (baseData[i][0] === dealRow[2] || baseData[i][0] === dealRow[5]) {
        baseSheet.getRange(i + 1, 9).setValue("завершино");
      }
    }
  } else {
    const baseData = baseSheet.getDataRange().getValues();
    for (let i = 1; i < baseData.length; i++) {
      if (baseData[i][0] === dealRow[2] || baseData[i][0] === dealRow[5]) {
        baseSheet.getRange(i + 1, 9).setValue("активно");
      }
    }
  }

  // Обновляем дату завершения сделки
  const dateRow = findDateRow(dealId, datesSheet);
  if (dateRow) {
    datesSheet.getRange(dateRow + 1, 6).setValue(new Date()); // Дата завершения сделки
  }

  return true;
}

// Получение ID встречи по ID сделки
function getMeetingIdByDealId(dealId) {
  const datesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Даты");
  const data = datesSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === dealId) {
      return data[i][2]; // ID встречи
    }
  }
  return null;
}

// Поиск строки встречи по ID
function findMeetingRow(meetingId, sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === meetingId) {
      return i;
    }
  }
  return null;
}

// Поиск строки даты по ID сделки
function findDateRow(dealId, sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === dealId) {
      return i;
    }
  }
  return null;
}

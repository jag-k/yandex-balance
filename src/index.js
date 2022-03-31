// --------------------------------------------
// Constants
// --------------------------------------------

const TIMEOUT = 10; // seconds
const CACHE_KEY = "yandex-badge-cache";

const SMALL = config.widgetFamily === "small";
const LARGE = config.widgetFamily === "large" || config.widgetFamily === "extraLarge";

// --------------------------------------------
// Run
// --------------------------------------------

let data = await getFoodData();
console.log(JSON.stringify(data, null, 2));

if (!data || data.days.length === 0) {
  if (Keychain.contains(CACHE_KEY)) {
    data = JSON.parse(await Keychain.get(CACHE_KEY));
    data.fromCache = true;
  }
} else {
  data.fromCache = false;
  data.lastUpdated = (new Date()).toLocaleString();
  Keychain.set(CACHE_KEY, JSON.stringify(data));
}

if (config.runsInApp || config.runsWithSiri) {
  await uiTable();
} else if (config.runsInWidget) {
  Script.setWidget(await balanceWidget());
}

Script.complete();


// --------------------------------------------
// Utils
// --------------------------------------------

/**
 * @param cell {UITableCell}
 * @returns {UITableCell}
 */
function rightAligned(cell) {
  cell.rightAligned();
  return cell;
}

/** @returns {ColorScheme} */
function colorScheme() {
  /** @type {ColorSchemeFonts} */
  const fonts = {
    titleFont: Font.boldSystemFont(18),
    labelFont: Font.mediumSystemFont(11),
  }

  /** @type {ColorSchemeColors} */
  const colors = {
    background: Color.dynamic(Color.white(), Color.black()),
    titleColor: Color.orange(),
    color: Color.dynamic(Color.black(), Color.white()),
    secondaryColor: Color.dynamic(Color.darkGray(), Color.lightGray()),
  }


  /** @type {ColorSchemeFunctions} */
  const functions = {
    text(text) {
      // text.font = fonts.font;
      text.textColor = colors.color;
      return text
    },
    title(text) {
      text.font = fonts.titleFont;
      text.textColor = colors.titleColor;
      return text
    },
    label(text) {
      text.font = fonts.labelFont;
      text.textColor = colors.secondaryColor;
      return text
    },

    secondary(text) {
      text.font = fonts.labelFont;
      text.textColor = colors.secondaryColor;
      return text
    },
  }

  return {
    ...fonts,
    ...colors,
    ...functions,
  }
}


// --------------------------------------------
// Logic
// --------------------------------------------

async function login(url) {
  const request = new Request(url);
  request.timeoutInterval = TIMEOUT;
  request.redirect = 'follow';

  let redirected = false;
  request.onRedirect = (r) => {
    redirected = true;
    return r;
  }
  let raw = '';

  try {
    raw = (await request.load()).toRawString();
  } catch (e) {
    console.error(e)
    return null;
  }

  if (redirected) {
    if (config.runsInWidget) {
      return null;
    }
    const webview = new WebView();
    await webview.loadHTML(raw, url);
    await webview.waitForLoad()
    await webview.present(false);
    // console.log(`window.location.url: ${await webview.evaluateJavaScript('window.location.url', false)}`);
  }

  const result = new WebView();
  result.shouldAllowRequest = (r) => {
    return r.url === 'about:blank' || r.url === url;
  };
  await result.loadHTML(raw, url);
  return result;
}

/**
 * @returns {Promise<Food>}
 */
async function getFoodData() {
  const url = `https://staff.yandex-team.ru/food`;

  const webview = await login(url);
  if (!webview) {
    console.error('Нет подключения к интернету');
    Script.complete()
    return {
      header: 'Нет подключения к интернету',
      data: [],
      days: [],
    };
  }

  // language=JavaScript
  const getData = `
    function normalize(str) {
      const s = str.replace('₽', '').replace(',', '.').trim();
      return isNaN(+s) ? s : +s;
    }

    function getData() {
      const layout = document.querySelector(".staff-layout");
      const balance = layout.querySelector(".staff-food-balance");
      const balanceHeader = balance.querySelector(".staff-food-balance__header").innerText;
      const balanceBody = balance.querySelector(".staff-food-balance__body");
      const balanceData = Array.from(balanceBody.querySelectorAll(".staff-food-balance__item")).map(item => {
        const name = item.querySelector(".staff-food-balance__caption").innerText.trim()
          .replace('Перерасход за месяц', 'Перерасход');
        const values = Array.from(item.querySelectorAll(".staff-food-balance__value"));
        const value = values.map(v => normalize(v.innerText));
        const isCurrency = values.reduce((p, v) => p || v.classList.contains("staff-currency"), false);
        return {name, value, isCurrency};
      });

      const days = [];
      const rows = Array.from(layout.querySelectorAll("tbody tr.b-table__row"));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td.b-table__cell"));
        if (cells.length === 1) {
          days.push({
            "day": cells[0].innerText.trim(),
            "food": []
          });
          continue;
        }
        days[days.length - 1].food.push(
          {
            "place": cells[0].innerText.trim(),
            "time": cells[1].innerText.trim(),
            "total": normalize(cells[2].innerText)
          });
      }

      return {
        header: balanceHeader,
        data: balanceData,
        days: days.reverse()
      }
    }

    getData()`

  return await webview.evaluateJavaScript(getData, false);
}

/**
 * @param food {FoodItem}
 */
function onSelectFoodRow(food) {
  return async () => {
    const alert = new Alert();
    alert.title = "Данные о заказе";
    alert.message =
      `Точка питания: "${food.place}"\n` +
      `Время заказа: ${food.time}\n` +
      `Сумма: ${food.total} ₽`;

    alert.addCancelAction('Закрыть');
    await alert.present();
  };
}


// --------------------------------------------
// UI
// --------------------------------------------

async function uiTable() {
  const table = new UITable();

  const title = new UITableRow();
  title.isHeader = true;
  title.height = 75;
  title.addText('Детальная информация по бейджу');
  table.addRow(title);


  const detailName = new UITableRow();
  detailName.isHeader = true;
  data.data.map(d => detailName.addText(d.name).widthWeight = 1);
  table.addRow(detailName);

  const detailValue = new UITableRow();
  data.data.map(d => detailValue.addText(d.value.join(' / ') + (d.isCurrency ? ' ₽' : '')).widthWeight = 1);
  table.addRow(detailValue);


  const header = new UITableRow();
  header.isHeader = true;
  header.addText('Точка питания');
  rightAligned(header.addText('Сумма'));
  table.addRow(header);

  for (const day of data.days) {
    const dayRow = new UITableRow();
    dayRow.isHeader = true;
    dayRow.addText(day.day);
    table.addRow(dayRow);

    for (const food of day.food) {
      const foodRow = new UITableRow();
      foodRow.onSelect = onSelectFoodRow(food);
      const placeCell = foodRow.addText(food.place);
      placeCell.widthWeight = 3;
      const totalCell = rightAligned(foodRow.addText(`${food.total} ₽`));
      totalCell.widthWeight = 1;

      table.addRow(foodRow);
    }
  }

  return await table.present();
}


async function balanceWidget() {
  const schema = colorScheme();
  const root = new ListWidget();
  root.backgroundColor = schema.background;
  const widget = root.addStack();
  widget.layoutVertically();


  const header = widget.addStack();
  const titleText = header.addText(`🍔 Бейдж`);
  titleText.font = schema.titleFont;
  titleText.textColor = schema.titleColor;
  header.layoutHorizontally();

  header.addSpacer();

  if (data.fromCache) {
    const symbol = SFSymbol.named('cloud.fill');
    symbol.applyFont(schema.titleFont);
    const symbolImage = header.addImage(symbol.image);
    symbolImage.resizable = false;
    symbolImage.imageOpacity = 0.35;
    symbolImage.tintColor = schema.color;
  }

  widget.addSpacer();

  const info = widget.addStack();

  const values = SMALL ? [data.data[0]] : data.data;
  values[values.length - 1].last = true;

  for (const item of values) {
    const infoItem = info.addStack();
    infoItem.layoutVertically();
    const {name, value} = item;
    const nameText = infoItem.addText(`${name}:`);
    nameText.textColor = schema.secondaryColor;
    nameText.font = schema.labelFont;
    infoItem.addSpacer(5);

    const valueText = infoItem.addText(`${value.join(' / ')}${item.isCurrency ? ' ₽' : ''}`);
    valueText.textColor = schema.color;
    if (!item.last) info.addSpacer();
  }

  widget.addSpacer(LARGE ? 10 : null);
  if (LARGE) {
    const realMaxRows = config.widgetFamily === 'extraLarge' ? 12 : 9;
    const userMaxRows = args.widgetParameter && !isNaN(+args.widgetParameter) ? +args.widgetParameter : realMaxRows;
    const maxRows = Math.max(0, Math.min(userMaxRows, realMaxRows));

    if (maxRows !== 0) {
      const detailsStack = widget.addStack();
      detailsStack.layoutVertically();

      detailsStack.addText('Детализация по дням').font = schema.labelFont;
      detailsStack.addSpacer(10);

      let rowsCounter = 0;
      let foodCounter = 0;

      for (const day of data.days) {
        rowsCounter++;
        if (rowsCounter + 1 > realMaxRows || foodCounter + 1 > userMaxRows) break;

        detailsStack.addSpacer(10);
        const dayStack = detailsStack.addStack();
        dayStack.layoutVertically();
        dayStack.addText(day.day).font = Font.boldSystemFont(14);
        dayStack.addSpacer(5);

        for (const food of day.food) {
          rowsCounter++;
          foodCounter++;
          if (rowsCounter > realMaxRows || foodCounter > userMaxRows) break;

          const foodStack = dayStack.addStack();
          foodStack.layoutHorizontally();
          schema.label(foodStack.addText(food.place));
          foodStack.addSpacer();
          schema.label(foodStack.addText(food.time));
          foodStack.addSpacer(10);
          schema.label(foodStack.addText(`${food.total} ₽`));

          dayStack.addSpacer(10);
        }
      }
      detailsStack.addSpacer();
    }
  }
  return root;
}

interface FoodItem {
    place: string,
    total: number,
    time: string
}

interface FoodDay {
    day: string,
    food: FoodItem[]
}
interface FoodData {
    name: string,
    isCurrency: boolean,
    value: (number | string)[]
}

export interface Food {
    header: string,
    data: FoodData[],
    days: FoodDay[],
    fromCache?: boolean,
    lastUpdated?: string,
}


export interface ColorSchemeColors {
    background: Color,
    titleColor: Color,
    color: Color,
    secondaryColor: Color,
}

export interface ColorSchemeFonts {
    titleFont: Font,
    labelFont: Font,
}
export interface ColorSchemeFunctions {
    title: (text: WidgetText) => WidgetText,
    label: (text: WidgetText) => WidgetText,
    secondary: (text: WidgetText) => WidgetText,
    text: (text: WidgetText) => WidgetText,
}

export interface ColorScheme extends ColorSchemeColors, ColorSchemeFonts, ColorSchemeFunctions {}

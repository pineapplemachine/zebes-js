export const zbsUnitsBytes: {name: string, amount: number}[] = [
    {name: "B", amount: 1},
    {name: "KB", amount: 1000},
    {name: "MB", amount: 1000000},
    {name: "GB", amount: 1000000000},
    {name: "TB", amount: 1000000000000},
];

export function zbsFormatUnitBytes(amount: number): string {
    let formatUnit = zbsUnitsBytes[0];
    for(let i = zbsUnitsBytes.length - 1; i--; i >= 0) {
        const unit = zbsUnitsBytes[i];
        if(unit.amount <= amount) {
            formatUnit = unit;
            break;
        }
    }
    if(formatUnit.amount <= amount) {
        return (amount / formatUnit.amount).toFixed(2) + formatUnit.name;
    }
    else {
        return (amount / formatUnit.amount).toFixed(3) + formatUnit.name;
    }
}

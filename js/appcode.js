function Calculate() {
    notional_salary = parseFloat(document.getElementById("notional_salary").value);
    pension_reduction = parseFloat(document.getElementById("pension_reduction").value);
    expected_monthly_salary = parseFloat(document.getElementById("expected_monthly_salary").value);
    previous_months_surplus = parseFloat(document.getElementById("previous_months_surplus").value);
    end_of_previous_month_balance = parseFloat(document.getElementById("end_of_previous_month_balance").value);
    salary_input = parseFloat(document.getElementById("salary_input").value);
    unallocated_bonus = parseFloat(document.getElementById("unallocated_bonus").value);
    allocated_bonus = parseFloat(document.getElementById("allocated_bonus").value);
    allocated_bonus_spending = parseFloat(document.getElementById("allocated_bonus_spending").value);
    inheritence = parseFloat(document.getElementById("inheritence").value);
    new_inheritence = inheritence - pension_reduction;
    document.getElementById("new_inheritence").value = (Math.round(new_inheritence * 100) / 100).toFixed(2);
    extra_unallocated_bonus = salary_input - expected_monthly_salary;
    document.getElementById("extra_unallocated_bonus").value = (Math.round(extra_unallocated_bonus * 100) / 100).toFixed(2);
    new_unallocated_bonus = unallocated_bonus + extra_unallocated_bonus;
    document.getElementById("new_unallocated_bonus").value = (Math.round(new_unallocated_bonus * 100) / 100).toFixed(2);
    new_allocated_bonus = allocated_bonus - allocated_bonus_spending;
    document.getElementById("new_allocated_bonus").value = (Math.round(new_allocated_bonus * 100) / 100).toFixed(2);
    surplus = end_of_previous_month_balance - salary_input - new_allocated_bonus - new_unallocated_bonus - new_inheritence;
    document.getElementById("surplus").value = (Math.round(surplus * 100) / 100).toFixed(2);
    variance = surplus - previous_months_surplus;
    document.getElementById("variance").value = (Math.round(variance * 100) / 100).toFixed(2);
    ConditionalFormatting();
}
function ConditionalFormatting() {
    var elements = document.getElementsByTagName("input");
    for (var i = 0; i < elements.length; i++) {
        if (parseFloat(elements[i].value) < 0.0) {
            elements[i].style.color = "red";
        } else {
            elements[i].style.color = "black";
        }
    }
}
from bs4 import BeautifulSoup

# --- 1. Define your fields and initial values ---
input_fields = [
    "notional_salary",
    "pension_reduction",
    "expected_monthly_salary",
    "previous_months_surplus",
    "end_of_previous_month_balance",
    "salary_input",
    "unallocated_bonus",
    "allocated_bonus",
    "allocated_bonus_spending",
    "inheritence",
]

values = {
    "notional_salary": "4500",
    "pension_reduction": "-1100",
    "expected_monthly_salary": "3455",
    "previous_months_surplus": "5900",
    "end_of_previous_month_balance": "70000",
    "salary_input": "3455",
    "unallocated_bonus": "23000",
    "allocated_bonus": "26000",
    "allocated_bonus_spending": "1000",
    "inheritence": "12000",
}

output_fields = [
    "extra_unallocated_bonus",
    "new_unallocated_bonus",
    "new_allocated_bonus",
    "new_inheritence",
    "surplus",
    "variance",
]

# --- 2. Start building the HTML document ---
soup = BeautifulSoup("", "html.parser")

html_tag = soup.new_tag("html")
soup.append(html_tag)

# 2a. <head> with meta
head = soup.new_tag("head")
meta = soup.new_tag(
    "meta",
    **{"http-equiv": "Content-Type", "content": "text/html; charset=utf-8"},
)
head.append(meta)
html_tag.append(head)

# 2b. <body> and embedded <style> and <script>
body = soup.new_tag("body")
html_tag.append(body)

style = soup.new_tag("style")
style.string = """
input[type=out] {
    border: none;
}
input[type=out]:focus {
    border: none;
    outline: none;
}
"""
body.append(style)

script = soup.new_tag("script")
script.string = """
function Calculate() {
"""
# 2c. Parse inputs
for field in input_fields:
    script.string += f"    {field} = parseFloat(document.getElementById('{field}').value);\n"

# 2d. Calculation logic
script.string += """
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
"""
body.append(script)

# --- 3. Build the table and form fields ---
table = soup.new_tag("table", width="100%")
body.append(table)

# 3a. Calculate button
tr_button = soup.new_tag("tr")
button_td = soup.new_tag("td", colspan="2")
button = soup.new_tag("button", id="Execute", width="100%", onclick="Calculate()")
button.string = "Calculate"
button_td.append(button)
tr_button.append(button_td)
table.append(tr_button)

# 3b. Input rows
for field in input_fields:
    tr = soup.new_tag("tr")
    # Label cell
    td_label = soup.new_tag("td")
    label = " ".join(word.capitalize() for word in field.split("_"))
    td_label.string = label
    tr.append(td_label)

    # Input cell with pound sign
    td_input = soup.new_tag("td")
    td_input.append(BeautifulSoup("&pound;&nbsp;&nbsp;", "html.parser"))
    input_tag = soup.new_tag(
        "input",
        type="in",
        id=field,
        value=values[field],
        onchange="Calculate()",
    )
    td_input.append(input_tag)
    tr.append(td_input)

    table.append(tr)

# 3c. Output rows (readonly)
for field in output_fields:
    tr = soup.new_tag("tr")

    td_label = soup.new_tag("td")
    label = " ".join(word.capitalize() for word in field.split("_"))
    td_label.string = label
    tr.append(td_label)

    td_out = soup.new_tag("td")
    td_out.append(BeautifulSoup("&pound;&nbsp;&nbsp;", "html.parser"))
    out_tag = soup.new_tag("input", type="out", id=field, readonly=True)
    td_out.append(out_tag)
    tr.append(td_out)

    table.append(tr)

# 3d. Final call to ConditionalFormatting on load
final_script = soup.new_tag("script")
final_script.string = "ConditionalFormatting();"
body.append(final_script)

# --- 4. Prettify and output ---
print(soup.prettify(formatter="html", indent_width=4))

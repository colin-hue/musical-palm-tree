from html5print import HTMLBeautifier

input_fields = ["notional_salary",
"pension_reduction",
"expected_monthly_salary",
"previous_months_surplus",
"end_of_previous_month_balance",
"salary_input",
"unallocated_bonus",
"allocated_bonus",
"allocated_bonus_spending",
"inheritence"]
values = {"notional_salary" : "4500",
"pension_reduction": "-1100",
"expected_monthly_salary": "3455",
"previous_months_surplus":"5900",
"end_of_previous_month_balance":"70000",
"salary_input":"3455",
"unallocated_bonus":"23000",
"allocated_bonus":"26000",
"allocated_bonus_spending":"1000",
"inheritence":"12000"}
output_fields = ["extra_unallocated_bonus",
"new_unallocated_bonus",
"new_allocated_bonus",
"new_inheritence",
"surplus",
"variance"]

html = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head> \
<body>\
<style>\
input[type=out] {\
border: none;\
}\
input[type=out]:focus {\
border: none;\
outline: none;\
}\
</style>\
<script>\
function Calculate()\
{'

for field in input_fields:
  html += field + '=parseFloat(document.getElementById("' + field + '").value);'

html +='\
new_inheritence = inheritence - pension_reduction;\
document.getElementById("new_inheritence").value = (Math.round((new_inheritence) * 100) / 100).toFixed(2);\
extra_unallocated_bonus= salary_input - expected_monthly_salary;\
document.getElementById("extra_unallocated_bonus").value = (Math.round((extra_unallocated_bonus) * 100) / 100).toFixed(2);\
new_unallocated_bonus = unallocated_bonus + extra_unallocated_bonus; \
document.getElementById("new_unallocated_bonus").value = (Math.round((new_unallocated_bonus) * 100) / 100).toFixed(2);\
new_allocated_bonus = allocated_bonus - allocated_bonus_spending;\
document.getElementById("new_allocated_bonus").value = (Math.round((new_allocated_bonus) * 100) / 100).toFixed(2);\
surplus = end_of_previous_month_balance - salary_input - new_allocated_bonus - new_unallocated_bonus - new_inheritence;\
document.getElementById("surplus").value = (Math.round((surplus) * 100) / 100).toFixed(2);\
variance = surplus - previous_months_surplus;\
document.getElementById("variance").value = (Math.round((variance) * 100) / 100).toFixed(2);\
ConditionalFormatting();\
}\
function ConditionalFormatting()\
{\
var elements = document.getElementsByTagName("input");\
for (var i = 0; i < elements.length; i++) {\
  if(parseFloat(elements[i].value) < 0.0 ) {\
    elements[i].style.color = "red";\
  }\
  else {\
    elements[i].style.color = "black";\
  }\
}\
}\
</script>\
<table width="100%"> \
<tr width="100%">\
<button id="Execute" width="100%" onclick="Calculate()">Calculate</button>\
</tr>'

for field in input_fields:
  html += "<tr><td>" + ' '.join(word[0].upper() + word[1:] for word in field.replace("_"," ").split()) + "</td><td>&pound;&nbsp;&nbsp;<input type=\'in\' id=\'" + field + "\' value="+values[field]+" onchange=\'Calculate()\'></td></tr>"
for field in output_fields:
  html += "<tr><td>" + ' '.join(word[0].upper() + word[1:] for word in field.replace("_"," ").split()) + "</td><td>&pound;&nbsp;&nbsp;<input type=\'out\' id=\'" + field + "\' readonly></td></tr>"

html +="</table>\
    <script>\
      ConditionalFormatting();\
    </script>\
</body>\
</html>"

print(HTMLBeautifier.beautify(html, 4))

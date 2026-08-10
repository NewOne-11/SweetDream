let schema;

let player={};



async function loadSchema(){


let response=
await fetch(
"data/player_schema.json"
);


schema=
await response.json();



createForm();



}





function createForm(){


let html="";


schema.sections.forEach(section=>{


html+=`

<h2>
${section.title}
</h2>

`;



section.fields.forEach(field=>{


html+=createField(field);


});


});



document.getElementById(
"creator"
)
.innerHTML=html;


}






function createField(field){


let html=`

<div class="field">

<label>

${field.title}

</label>

`;



if(field.type==="text"){


html+=`

<input

id="${field.path}"

>

`;

}


else if(
field.type==="number"
){


html+=`

<input

type="number"

id="${field.path}"

>

`;

}



else if(
field.type==="textarea"
){


html+=`

<textarea

id="${field.path}"

></textarea>

`;

}



else if(
field.type==="radio"
){


field.options.forEach(option=>{


html+=`

<label>

<input

type="radio"

name="${field.path}"

value="${option}"

>

${option}

</label>


`;

});


}



else if(
field.type==="checkbox"
){


field.options.forEach(option=>{


html+=`

<label>

<input

type="checkbox"

name="${field.path}"

value="${option}"

>

${option}

</label>


`;

});


}



html+="</div>";


return html;


}







function saveCharacter(){


console.log(
"保存角色"
);



schema.sections.forEach(section=>{


section.fields.forEach(field=>{


let element=
document.getElementById(
field.path
);


if(element){


console.log(
field.path,
element.value
);


}



});


});


alert(
"角色创建完成（测试版）"
);



}




loadSchema();

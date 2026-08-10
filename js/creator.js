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







function setValueByPath(obj,path,value){


let keys =
path.split(".");


let current=obj;


for(
let i=0;
i<keys.length-1;
i++
){

if(
!current[keys[i]]
){

current[keys[i]]={};

}


current=current[keys[i]];


}


current[
keys[keys.length-1]
]
=value;


}





function getRadioValue(path){


let checked=
document.querySelector(
`input[name="${path}"]:checked`
);


return checked?
checked.value:
"";


}





function getCheckboxValue(path){


let checked=
document.querySelectorAll(
`input[name="${path}"]:checked`
);


return Array.from(
checked
)
.map(
item=>item.value
);


}







function saveCharacter(){


let player={};



schema.sections.forEach(section=>{


section.fields.forEach(field=>{


let value;



if(
field.type==="checkbox"
){

value=
getCheckboxValue(
field.path
);


}

else if(
field.type==="radio"
){

value=
getRadioValue(
field.path
);


}

else{


let element=
document.getElementById(
field.path
);


value=
element?
element.value:
"";


}



setValueByPath(

player,

field.path,

value

);



});


});



console.log(
"角色数据:",
player
);



localStorage.setItem(

"testPlayer",

JSON.stringify(
player

)

);



alert(
"角色创建完成"
);



}

let schema = null;


/*
角色数据对象
*/
let player = {};



/*
加载角色模板
*/

async function loadSchema(){

    try{

        let response = await fetch(
            "data/player_schema.json"
        );


        if(!response.ok){

            throw new Error(
                "无法读取 player_schema.json"
            );

        }


        schema = await response.json();


        console.log(
            "模板加载成功",
            schema
        );


        createForm();


    }
    catch(error){

        console.error(
            error
        );


        document.getElementById(
            "creator"
        ).innerHTML =

        "角色模板加载失败：<br>" 
        + error.message;

    }

}





/*
生成表单
*/

function createForm(){

    let html = "";


    schema.sections.forEach(section=>{


        html += `

        <div class="section">

        <h2>
        ${section.title}
        </h2>

        `;


        section.fields.forEach(field=>{


            html += createField(field);


        });


        html += "</div>";

    });



    document.getElementById(
        "creator"
    ).innerHTML = html;


}







/*
生成单个字段
*/

function createField(field){


    let html = `

    <div class="field">

    <label>
    ${field.title}
    </label>

    `;



    switch(field.type){


        case "text":


            html += `

            <input

            type="text"

            id="${field.path}"

            >

            `;

            break;



        case "number":


            html += `

            <input

            type="number"

            id="${field.path}"

            >

            `;

            break;




        case "textarea":


            html += `

            <textarea

            id="${field.path}"

            ></textarea>

            `;

            break;




        case "select":


            html += `

            <select

            id="${field.path}"

            >

            `;


            field.options.forEach(option=>{


                html += `

                <option>
                ${option}
                </option>

                `;


            });


            html += `

            </select>

            `;


            break;






        case "radio":



            field.options.forEach(option=>{


                html += `

                <label>

                <input

                type="radio"

                name="${field.path}"

                value="${option}"

                >

                ${option}

                </label>

                <br>


                `;


            });


            break;







        case "checkbox":



            field.options.forEach(option=>{


                html += `

                <label>


                <input

                type="checkbox"

                name="${field.path}"

                value="${option}"

                >


                ${option}


                </label>

                <br>


                `;


            });


            break;



    }



    html += "</div>";


    return html;


}








/*
根据路径写入对象

例如：

body.basic.skin

自动生成：

player.body.basic.skin

*/


function setValueByPath(
    obj,
    path,
    value
){


    let keys =
    path.split(".");


    let current =
    obj;



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


        current =
        current[keys[i]];


    }



    current[
        keys[keys.length-1]
    ]
    =
    value;


}







/*
读取radio
*/

function getRadioValue(path){


    let checked =
    document.querySelector(
        `input[name="${path}"]:checked`
    );


    if(checked){

        return checked.value;

    }


    return "";

}







/*
读取checkbox

返回数组

*/

function getCheckboxValue(path){


    let checked =
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








/*
保存角色

目前：

生成JSON

下一步接IndexedDB

*/

function saveCharacter(){



    player = {};



    schema.sections.forEach(section=>{


        section.fields.forEach(field=>{


            let value;



            if(
                field.type==="radio"
            ){

                value =
                getRadioValue(
                    field.path
                );


            }


            else if(
                field.type==="checkbox"
            ){

                value =
                getCheckboxValue(
                    field.path
                );


            }


            else{


                let element =
                document.getElementById(
                    field.path
                );


                value =
                element ?
                element.value :
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
        "生成角色数据：",
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






/*
启动
*/

loadSchema();

let db;


/*
打开数据库

名字：
SweetDreamDB

版本：
1
*/

function openDatabase(){


    return new Promise(
    (resolve,reject)=>{


        let request =
        indexedDB.open(
            "SweetDreamDB",
            1
        );



        request.onerror=function(){

            reject(
                "数据库打开失败"
            );

        };



        request.onsuccess=function(e){


            db =
            e.target.result;


            console.log(
                "数据库连接成功"
            );


            resolve(db);


        };




        request.onupgradeneeded=function(e){


            let database =
            e.target.result;



            /*
            角色表
            */


            if(
                !database.objectStoreNames.contains(
                    "characters"
                )
            ){


                database.createObjectStore(

                    "characters",

                    {
                        keyPath:"id"

                    }

                );


            }



            /*
            长期记忆
            */


            if(
                !database.objectStoreNames.contains(
                    "memory"
                )
            ){


                database.createObjectStore(

                    "memory",

                    {
                        keyPath:"id"

                    }

                );

            }




            /*
            当前状态

            */


            if(
                !database.objectStoreNames.contains(
                    "state"
                )
            ){


                database.createObjectStore(

                    "state",

                    {
                        keyPath:"id"

                    }

                );


            }



        };


    });


}









/*
保存角色
*/

function saveCharacterDB(character){


    return new Promise(
    (resolve,reject)=>{


        let transaction =

        db.transaction(

            "characters",

            "readwrite"

        );


        let store =

        transaction.objectStore(
            "characters"
        );



        store.put(

        {

            id:
            character.profile.identity.name,


            data:
            character,


            time:
            Date.now()

        }

        );



        transaction.oncomplete=function(){

            resolve();

        };


        transaction.onerror=function(){

            reject();

        };


    });


}








/*
读取角色
*/

function getCharacterDB(id){


    return new Promise(
    (resolve,reject)=>{


        let transaction =

        db.transaction(

            "characters",

            "readonly"

        );


        let store =

        transaction.objectStore(
            "characters"
        );



        let request =

        store.get(id);



        request.onsuccess=function(){


            resolve(
                request.result
            );


        };


        request.onerror=function(){

            reject();

        };


    });


}
